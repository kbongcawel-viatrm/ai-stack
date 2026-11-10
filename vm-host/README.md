# vm-host — Provision & Harden Fedora CoreOS with Kasm Workspaces

Modular, repeatable FCOS provisioning split across three levels. Every
config file lives as a **raw fragment** — edit the fragment, re-run
`build.sh`, boot the result. Nothing is embedded in a monolith.

## Layout

```text
vm-host/
├── build.sh                  # composable pipeline: transpile modules → merge → vm-host.ign
├── butane_modules/           # each module is a standalone valid Butane file
│   ├── 00-base-system.bu     # always: core user, SSH keyfile, static NM network, sysctl/sshd/journald/zincati
│   ├── 10-package-layer.bu   # always: security-setup (rpm-ostree via the toggles, stamp, one reboot) + security-finalize
│   ├── 20-firewalld.bu       # ENABLE_FIREWALLD
│   ├── 21-suricata.bu         # ENABLE_SURICATA
│   ├── 22-clamav.bu           # ENABLE_CLAMAV
│   ├── 23-aide.bu             # ENABLE_AIDE
│   ├── 24-lynis.bu            # ENABLE_LYNIS
│   ├── 30-kasm-workspaces.bu  # ENABLE_KASM
│   └── 40-home-security.bu    # ENABLE_HOME_SECURITY
├── 1_host_level/             # host hardening fragments (installed to /etc by the modules)
│   ├── sshd-hardening.conf, journald-hardening.conf, sysctl-kasm.conf, zincati-updates.toml
│   └── files/{aide,aide.conf, clamav/freshclam.conf, suricata/{suricata.yaml,suricata.rules}, firewalld/firewall-rules.xml}
├── 2_systemd_level/          # unit fragments referenced by the modules (installed verbatim)
│   ├── security-setup.service    # 1st boot: rpm-ostree layer (@VM_HOST_PACKAGES@) + stamp + one reboot
│   ├── security-finalize.service + .sh  # every boot after: zone bind, ET rules, freshclam, AIDE baseline, .env, timers
│   ├── kasm-workspace.service, container-update.{service,timer}
│   ├── home-security.service
│   └── {clamav,aide,lynis}-daily.{service,timer}
└── 3_container_level/kasm/docker-compose.yaml   # three standalone KasmVNC workspaces
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
ENABLE_SURICATA=0 ENABLE_AIDE=0 ./build.sh    # exclude modules + their packages
```

The package list layered by `security-setup.service` is derived from the
same toggles (`@VM_HOST_PACKAGES@` is substituted by build.sh) — a module
that is off is absent from both the Ignition merge and the rpm-ostree
install. `vm-host.ign` is first-boot only (persistent overlay boots without
Ignition afterwards, per the qemu_provisioner design).

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

## Deployment (first boot)

`vm-host.ign` is fed to QEMU via `-fw_cfg name=opt/com.coreos/config,file=...`
or `coreos-installer ignition embed` on **first boot only** — a persistent
overlay boots without Ignition afterwards (per the qemu_provisioner design).
The Ansible playbook in `diskless-os/ansible/` remains available but is no
longer part of the build path.

## Operational notes (from the fcos-kasm-platform design)

- **Single layering reboot**: `security-setup.service` owns
  `/var/lib/vm-host-packages.stamp`; `security-finalize.service` gates on it.
- **Runtime writes go to /var only** (FCOS root is read-only outside /etc);
  `/opt/kasm` is Ignition-provisioned first boot, stack clones live under
  `/var/opt/...`.
- **No GPU / no `/dev/dri` passthrough** — KasmVNC falls back to MESA
  llvmpipe; forcing DRI3 breaks workspace launches.
- **Kasm install**: `install.sh --accept-eula --no-swap-check` (FCOS has no
  swap; ZRAM only). Admin creds land in the journal:
  `journalctl -u kasm-workspace.service | grep -A5 "admin@kasm.local"`.
- **Suricata** needs `Group=suricata`-readable config (0644), traversable
  `/etc/suricata`, suricata-owned rules and writable log/run dirs, and a
  complete `vars` block (fetched ET Open rules are validated in finalize).
  `NoNewPrivileges` must stay off units exec'ing `nft`/`suricata`.
- **Windows workspaces are not containers**: register the Windows host as a
  Kasm *Server* (RDP) under Infrastructure → Servers; TCP 3389 outbound is
  allowed from the LAN in the firewalld zone.
- Host DNS quirk: SLIRP DNS is unreliable (host resolv.conf is 127.0.0.1 via
  dnsconfd); use the libvirt bridge (`br0`) for the guest network.
