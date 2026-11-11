# vm-host — Provision & Harden Fedora CoreOS with Kasm Workspaces

Modular, repeatable FCOS provisioning split across three levels. Every
config file lives as a **raw fragment** — edit the fragment, re-run
`build.sh`, boot the result. Nothing is embedded in a monolith.

## Layout

```text
vm-host/
├── Makefile                  # direct host-side driver: deploy, status, console, clean
├── build.sh                  # composable pipeline: transpile modules → merge → vm-host.ign
├── deploy.sh                 # provision the VM on host libvirt (no CI, no Ansible)
├── container/                # disposable provisioning runner: Containerfile, entrypoint.sh, up.sh
├── butane_modules/           # each module is a standalone valid Butane file
│   ├── 00-base-system.bu     # always: core user, SSH keyfile, static NM network, sshd/journald/sysctl/zincati + security-baseline
│   ├── 05-zincati-maintenance.bu # always: weekly reboot window — updates stage anytime, reboot only inside it
│   ├── 50-container-stack.bu # always: /opt/stack compose stack + systemd units (edge/kasm/audit profiles)
│   └── 40-home-security.bu    # ENABLE_HOME_SECURITY
├── 1_host_level/             # host hardening fragments (installed to /etc by Ignition)
│   ├── sshd-hardening.conf, journald-hardening.conf, sysctl-kasm.conf,
│   │   sysctl-hardening.conf (CIS-style kernel/net params), zincati-*.toml
├── 2_systemd_level/          # unit/script fragments referenced by the modules
│   ├── security-baseline.{service,sh}  # masks unwanted units, locks accounts, kernel module blacklist
│   ├── security-finalize.{service,sh}  # swap, podman-compose layer, .env, ET rules, aide init
│   └── home-security.service
└── 3_container_level/stack/  # the containerized service stack
    ├── compose.yaml          # profiles: edge (firewalld+suricata), kasm (3 workspaces), audit (aide/lynis/clamav)
    ├── containers/           # Containerfiles: firewalld, aide, lynis, clamav
    └── {suricata,firewalld,clamav,aide,lynis}/  # per-service configs
```

## Build (composable Butane, no Ansible)

Requires: `butane`, `python3`. The pipeline follows the fcos-kasm-platform
skill: each `butane_modules/*.bu` transpiles standalone with
`butane --strict --files-dir`, then a generated root config merges the
selected fragments via `ignition.config.merge` (butane inlines them as
gzip+base64 `data:` URLs, so the single output file is fully
self-contained for `fw_cfg` / `coreos-installer ignition embed`).

```bash
export FCOS_SSH_PUBLIC_KEY='ssh-ed25519 ...'
export FCOS_CORE_PASSWORD_HASH='$6$...'        # openssl passwd -6
export FCOS_INTERFACE=ens2                     # libvirt NIC at PCI slot 0x02 → ens2
export FCOS_LAN_IP=192.168.1.201              # defaults: CIDR 192.168.1.0/24, gw 192.168.1.1
./build.sh          # → vm-host.ign (all modules)
ENABLE_HOME_SECURITY=0 ./build.sh   # only remaining build-time toggle
```

There is **no rpm-ostree package layering** for services anymore — podman
is in the FCOS base and everything runs as containers. The only layering
is a tiny `python3 podman-compose` install inside `security-finalize.sh`
(`--apply-live`, stamped, no reboot), because FCOS excludes python3.
Per-service selection happens at runtime via compose profiles
(`edge`/`kasm`/`audit`), not at build time. `vm-host.ign` is first-boot
only (persistent overlay boots without Ignition afterwards).

## Deployment targets (plan)

Provisioning ships three browser-reachable workspaces plus one security
monitoring stack:

| Workload | Source | Endpoint | Notes |
|---|---|---|---|
| **Ubuntu desktop** | `kasmweb/ubuntu-noble-desktop` | `https://<vm>:6901` | general workspace |
| **LibreWolf browser** | [librewolf.net](https://librewolf.net/) via `lscr.io/linuxserver/librewolf` | `https://<vm>:3101` | privacy-hardened Firefox workspace |
| **Linux OS (Arch XFCE)** | [bolens/kasm-workspace-images](https://github.com/bolens/kasm-workspace-images) → `ghcr.io/bolens/kasm-workspace-images/archlinux` (also `cachyos`, `bazzite`) | `https://<vm>:3201` | digest-pin via `sha-<commit>` tags (SBOMs published per build) |
| **home-security.uk v2** | [kbongcawel-viatrm/v2.home-security.uk](https://github.com/kbongcawel-viatrm/v2.home-security.uk) | dashboard on `127.0.0.1:5080` (OpenObserve) | cloned to `/var/opt/home-security` by `home-security.service`; see below |

### home-security.uk v2 prerequisites (manual, once)

The stack's `compose.yaml` expects an `.env` (OpenObserve user/password,
Ollama model, TZ) and builds `local/*` images on-host (openobserve-with-curl,
fluent-bit-hardened; worker images come from Harbor). After first boot:

```bash
cd /var/opt/home-security/v2.home-security.uk
cp .env.example .env && edit .env
docker compose build openobserve fluent-bit
systemd-run ... or: systemctl restart home-security.service
```

Ports are published on `127.0.0.1` only; reach the dashboards over SSH
tunnels or put them behind the Kasm-managed reverse proxy.

## Deployment

Two ways to run the same pipeline — pick one:

### Containerized (recommended — disposable provisioning runner)

```bash
# on the host, inside vm-host/ (needs rootless podman + FCOS_* env):
export FCOS_SSH_PUBLIC_KEY='ssh-ed25519 ...'
export FCOS_CORE_PASSWORD_HASH='$6$...'
make up        # builds container/image once, renders + provisions, self-cleans
```

The container holds only tools/temp state — `podman rm` wipes it. The VM
still runs on **host** libvirt (`qemu:///system`, `br0`). Persistent state:

- `~/fcos-vm/` (`STATE_DIR` override) — base image, overlay, `.ign`, domain XML
- host libvirt domain `fcos-kasm` — remove with `make clean` + `rm -rf ~/fcos-vm`

### Direct on the hypervisor

```bash
# on the hypervisor, inside vm-host/ (br0 must already exist):
run0 make deploy                    # render vm-host.ign + provision the VM
make status                         # virsh dominfo
make console                        # serial console of first boot
make ssh                            # ssh -i ~/.ssh/core core@192.168.1.201
make clean                          # remove the domain + overlay (base image kept)
```

`deploy.sh` fetches and sha256-verifies the FCOS stable qcow2 (or a pinned
pair via `FCOS_QCOW2_URL` + `FCOS_QCOW2_SHA256`), creates the writable
overlay, and defines/starts the domain with Ignition injected via `fw_cfg`
on **first boot only** — a persistent overlay boots without Ignition
afterwards. It never destroys an existing domain — removal is the explicit
`make clean`.

Reusable: `make deploy` skips the (already-verified) base download and the
existing overlay; set `RECREATE_OVERLAY=1 ./deploy.sh` for a fresh disk.
Host requirements: libvirt (`virsh`, `virt-install`), `qemu-img`, `curl`,
`xz`, `/dev/kvm`, bridge `br0` (host-direct mode only — the container path
validates it host-side). The Ansible playbooks in
`diskless-os/ansible/` remain available but are not part of the build path,
and no GitHub Actions workflow is involved.

Workspaces land on the Kasm ports listed above once `security-finalize`
has applied the podman-compose layer, generated `/var/opt/stack/.env`,
fetched the Suricata ET bundle, and `stack-kasm.service` has pulled the
images; `make logs` tails the finalize unit and `journalctl -u
stack-*.service` shows the stack units.

## Operational notes (from the fcos-kasm-platform design)

- **Containerized services, podman runtime**: the stack lives at
  `/var/opt/stack` (`/opt/stack`); `/var/opt/stack/bin/docker-compose` is a
  shim exec'ing `podman-compose` so units keep the `docker compose` call
  shape. Manage it with
  `cd /var/opt/stack && ./bin/docker-compose --profile <edge|kasm|audit> ...`.
- **Security baseline runs every boot**: `security-baseline.service`
  (CIS-style masking/account/module assertions) and
  `security-finalize.service` (swap, pytools layer, .env, ET rules, aide
  init) are both idempotent; audit results land in `/var/log/{aide,lynis,
  clamav}` and Lynis reports feed the daily `stack-lynis-scan.timer`.
- **Runtime writes go to /var only** (FCOS root is read-only outside /etc);
  the stack lives under `/var/opt/stack`, state under `/var/lib/*`.
- **No GPU / no `/dev/dri` passthrough** — KasmVNC falls back to MESA
  llvmpipe; forcing DRI3 breaks workspace launches.
- **Suricata** runs as a container with `network_mode: host` + AF_PACKET;
  ET Open rules are fetched once by `security-finalize` via
  `podman run ... suricata-update`, then the container is restarted.
- **Windows workspaces are not containers**: register the Windows host as a
  Kasm *Server* (RDP) under Infrastructure → Servers; TCP 3389 outbound is
  allowed from the LAN in the firewalld zone.
- Host DNS quirk: SLIRP DNS is unreliable (host resolv.conf is 127.0.0.1 via
  dnsconfd); use the libvirt bridge (`br0`) for the guest network.
