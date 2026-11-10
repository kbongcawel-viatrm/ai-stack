# fcos-kasm-platform

Modular, repeatable provisioning of a hardened Fedora CoreOS VM host running
Kasm workspace containers. Composable Butane fragments are transpiled and
merged via `ignition.config.merge`; Ansible roles handle rendering, VM
provisioning, and post-boot configuration.

## Quickstart

Run on the hypervisor host (Secureblue), from the repo root:

```bash
cd fcos-kasm-platform

# one-time setup
ansible-galaxy collection install -r requirements.yml
# pin fcos_coreos_build in roles/qemu_provisioner/defaults/main.yml
# ensure br0 has a carrier:  bridge link

# credentials (never committed)
export FCOS_SSH_PUBLIC_KEY="$(cat ~/.ssh/core.pub)"
export FCOS_CORE_PASSWORD_HASH="$(openssl passwd -6)"

# provision end-to-end
./build.sh all
```

`./build.sh all` renders the Ignition config, downloads the FCOS image,
creates the VM overlay, boots it, waits through the first-boot package
layering reboot, and fetches the Kasm credentials. Step-by-step:

```bash
./build.sh render       # butane -> build/config.ign
./build.sh provision    # qcow2 overlay + libvirt domain + boot
./build.sh configure    # post-boot SSH setup
./build.sh clean        # remove build/ artifacts
```

Or via make: `make all`, `make render`, `make provision`, `make configure`,
`make clean`, `PROFILE=kasm-only make render`.

Result: KasmVNC workspaces on `https://192.168.1.201:{6901,3101,3201}`
(Ubuntu desktop, LibreWolf, Arch Linux). Password in
`/var/opt/kasm/.env` on the guest.

Everything below is reference detail — you can stop reading here.

## Layout

```text
fcos-kasm-platform/
├── build.sh                  # host-level driver: render/provision/configure/all/clean
├── Makefile                  # same targets via make
├── site.yml                  # tag-driven orchestrator (render → provision → configure)
├── inventory.ini             # hypervisor (localhost) + fcos_vm groups
├── ansible.cfg
├── requirements.yml          # community.general (run0 privilege escalation)
├── group_vars/
│   ├── all.yml               # feature toggles, network, identity, derived lists
│   └── fcos_vm.yml           # guest connection vars
├── profiles/                 # extra-vars profiles for CI/render variants
│   ├── full-dhcp.yml
│   ├── full-static.yml
│   └── kasm-only.yml
├── butane_modules/           # standalone .bu.j2 fragments + payload files
│   ├── 00-base-system/       # core user, SSH/journald/sysctl/zincati, static IP
│   ├── 10-rpm-ostree/        # package layering unit + single reboot + stamp
│   ├── 20-firewalld/         # fcos-workspace zone + post-layering init
│   ├── 21-suricata/          # IDS config, local rules, ET Open bootstrap
│   ├── 22-clamav/            # freshclam config + daily update/scan timer
│   ├── 23-aide/              # integrity baseline + daily check timer
│   ├── 24-ops-monitoring/    # Lynis daily audit timer
│   └── 30-kasm-workspaces/   # KasmVNC compose stack + home-security.uk v2
└── roles/
    ├── butane_composer/      # render → transpile → merge → build/config.ign
    ├── qemu_provisioner/     # FCOS QCOW2 download, overlay, libvirt domain
    └── kasm_configurator/    # post-boot SSH: .env fetch, optional Kasm API
```

## How it works

1. **Render** (`--tags render`, localhost): each enabled `butane_modules/*.bu.j2`
   is templated, transpiled with `butane --strict`, and merged into
   `build/config.ign` via `ignition.config.merge`.
2. **Provision** (`--tags provision`, hypervisor): downloads the pinned FCOS
   stable QCOW2, creates a qcow2 overlay (`qemu-img`), and defines/starts a
   libvirt domain on `br0`. Ignition is passed via `-fw_cfg` **only on first
   boot of a fresh overlay**.
3. **Guest first boot**: `rpm-ostree-layer.service` installs the package set
   (assembled from the `enable_*` toggles), stamps
   `/var/lib/rpm-ostree-install.stamp`, and reboots once.
4. **Guest second boot**: each module's `<svc>-init.service` (gated on the
   stamp) performs post-layering bring-up — zone binding, `suricata-update`,
   freshclam/AIDE baselines, timer enables, `/var/opt/kasm` staging.
5. **Configure** (`--tags configure`, SSH as `core`): waits for the guest,
   fetches the generated `KASM_VNC_PASSWORD`, optionally drives the upstream
   Kasm API (full-server mode only).

## Prerequisites

Run everything **on the hypervisor host** (Secureblue), not inside a
container — `/var/lib/libvirt` must be the host's.

- `ansible-core` + `community.general` collection (`run0` become method)
- `butane` ≥ 0.23.0 (static binary OK; `BUTANE=/path/to/butane`)
- `python3`, `qemu-img`, `virsh` (libvirt), `git` on the guest side
- `br0` bridge up with a carrier (enslaved NIC) — see "Bridge" below
- Passwordless `run0` for your user (test: `run0 -u root true`)

```bash
cd fcos-kasm-platform
ansible-galaxy collection install -r requirements.yml
```

## Configuration

All toggles live in `group_vars/all.yml`:

| Var | Default | Effect |
|-----|---------|--------|
| `enable_firewalld` | `true` | zone lockdown + init |
| `enable_suricata` | `true` | IDS + ET Open rules |
| `enable_clamav` | `true` | freshclam + daily scan timer |
| `enable_aide` | `true` | integrity baseline + daily timer |
| `enable_lynis` | `true` | daily audit timer |
| `enable_kasm` | `true` | KasmVNC compose stack |
| `enable_home_security` | `true` | v2.home-security.uk stack (inside 30-kasm) |
| `use_static_ip` | `true` | NM keyfile for `fcos_lan_ip` |

Each toggle gates **both** the butane module and its rpm-ostree packages —
the Jinja in `all.yml` is the single source of truth.

Secrets are never committed — export before rendering:

```bash
export FCOS_SSH_PUBLIC_KEY="$(cat ~/.ssh/core.pub)"
export FCOS_CORE_PASSWORD_HASH="$(openssl passwd -6)"   # console fallback
```

## Run it

`build.sh` (or the `Makefile` targets) wraps the Ansible pipeline — it
locates `ansible-playbook`/`butane`, checks required env vars, and runs the
right tags in order. `make` targets: `render`, `provision`, `configure`,
`all` (default), `clean`.

```bash
cd ~/workspace/ai-stack/fcos-kasm-platform

# 0) one-time: pin the FCOS build (see "FCOS image" below), ensure br0 has carrier

export FCOS_SSH_PUBLIC_KEY="$(cat ~/.ssh/core.pub)"
export FCOS_CORE_PASSWORD_HASH="$(openssl passwd -6)"   # console fallback

# 1) render Ignition
./build.sh render            # or: make render
#    → build/config.ign (valid JSON, N modules merged)

# 2) provision the VM (downloads ~600MB base image once)
./build.sh provision         # renders first if config.ign is missing

# 3) wait for first boot + the rpm-ostree reboot (5–15 min), then:
./build.sh configure         # or: make all  (render → provision → configure)
```

Direct Ansible equivalents (same thing, more control):

```bash
BUTANE=~/.local/bin/butane ansible-playbook -i inventory.ini site.yml --tags render
ansible-playbook -i inventory.ini site.yml --tags provision
ansible-playbook -i inventory.ini site.yml --tags configure
```

### Profile overrides

```bash
./build.sh render -e @profiles/kasm-only.yml
# or
PROFILE=kasm-only make render
```

## Guest endpoints

After configure, on `fcos_lan_ip` (default `192.168.1.201`):

| Service | URL | Notes |
|---------|-----|-------|
| Ubuntu desktop (KasmVNC) | `https://<ip>:6901` | self-signed cert |
| LibreWolf browser | `https://<ip>:3101` | LinuxServer KasmVNC |
| Arch Linux XFCE (bolens) | `https://<ip>:3201` | GHCR image |
| home-security.uk v2 | per its compose | multi-service stack |

`KASM_VNC_PASSWORD` is generated once into `/var/opt/kasm/.env` on the guest
(`root:core 0640` — readable over SSH as `core`, no privilege escalation).

## FCOS image pin

`roles/qemu_provisioner/defaults/main.yml` → `fcos_coreos_build` must match a
real stable build or the download 404s. Check
<https://builds.coreos.fedoraproject.org/streams/stable/builds/> and update
the pin (and optionally `fcos_base_image_sha256`).

## Bridge (br0)

The domain attaches a virtio NIC to `br0`. The bridge must have a carrier —
a slave interface and the `192.168.1.x` addressing — before provisioning:

```bash
bridge link            # must list the slave NIC
ip -4 addr show br0
```

If `br0` has no ports, run the hypervisor prep playbook from the repo root:

```bash
cd ~/workspace/ai-stack
ansible-playbook -i /tmp/fcos-inventory.yml \
  diskless-os/ansible/playbooks/prepare-hypervisor.yml
```

## Verification / troubleshooting

```bash
# render only
ansible-playbook -i inventory.ini site.yml --tags render

# guest logs after provisioning
ssh -i ~/.ssh/core core@192.168.1.201
journalctl -u rpm-ostree-layer.service -b      # package layering
systemctl list-units '*-init.service' --all    # per-module bring-up
journalctl -u suricata-init.service -u kasm-init.service -b
```

Common failures:

| Symptom | Cause / fix |
|---------|-------------|
| Image download 404 | `fcos_coreos_build` pin is stale — update it |
| VM has no network | `br0` has no slave/carrier — run prepare-hypervisor.yml |
| `run0` prompts/hangs | polkit needs interactive auth — run `run0 -u root true` to test; adjust `hypervisor_become_method` |
| `configure` times out | guest still layering/rebooting — check `rpm-ostree-layer.service` journal |
| SSH auth fails | `FCOS_SSH_PUBLIC_KEY` didn't match `~/.ssh/core` — re-render + reprovision (fresh overlay) |

## CI

`.github/workflows/validate-butane.yml` renders all three profiles
(`full-dhcp`, `full-static`, `kasm-only`) on `ubuntu-latest` and asserts
`build/config.ign` is valid JSON. It runs on pushes touching
`fcos-kasm-platform/`.

## Notes / limitations

- These are **standalone KasmVNC containers**, not the full Kasm Workspaces
  server. For the upstream platform (images/agents/API), use the `kasm`
  skill's install path instead — `kasm_configurator` already has the
  API/Windows-RDP scaffolding behind `kasm_api_enabled`.
- `home-security.service` clones `v2.home-security.uk` at first boot; its
  `local/*` images (openobserve-with-curl, fluent-bit-hardened) must be built
  on-host or pre-seeded — `docker compose pull --ignore-buildable` is
  best-effort.
- Ignition is only injected on **first boot of a fresh overlay**. To rebuild
  from scratch, delete `/var/lib/libvirt/images/fcos-kasm-poc/` and re-run
  `--tags provision`.
- `vm-host/` (sibling directory) is the earlier single-manifest variant;
  this platform supersedes it but both are kept for reference.
