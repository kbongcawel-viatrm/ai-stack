# vm-host — Provision & Harden Fedora CoreOS with Kasm Workspaces

Modular, repeatable FCOS provisioning split across three levels. Every
config file lives as a **raw fragment** — edit the fragment, re-run
`build.sh`, boot the result. Nothing is embedded in a monolith.

## Layout

```text
vm-host/
├── build.sh                  # render fragments + butane --strict -> vm-host.ign (DEPLOY=1 runs Ansible)
├── config.bu                 # root Butane config; pulls fragments via contents: local:
├── 1_host_level/             # host hardening (files installed to /etc)
│   ├── sshd-hardening.conf   # → /etc/ssh/sshd_config.d/00-hardening.conf
│   ├── journald-hardening.conf
│   ├── sysctl-kasm.conf      # kernel hardening + container/Kasm sysctls
│   ├── zincati-updates.toml  # FCOS autoupdate window (Sun 04:00–06:00)
│   └── files/
│       ├── aide/aide.conf
│       ├── clamav/freshclam.conf
│       ├── suricata/suricata.yaml   # full Suricata config (readable by the suricata user)
│       ├── suricata/suricata.rules
│       └── firewalld/firewall-rules.xml  # fcos-workspace zone (SSH/443/80/6901/3101/3201/3389)
├── 2_systemd_level/          # systemd units (installed verbatim)
│   ├── security-setup.service    # 1st boot: rpm-ostree layer + stamp + one reboot
│   ├── security-finalize.service # every boot after: zone bind, ET rules, freshclam,
│   │                             # AIDE baseline, timer enablement (idempotent script)
│   ├── security-finalize.sh      #   → /usr/local/sbin/security-finalize.sh
│   ├── kasm-workspace.service    # Kasm install.sh once, then compose lifecycle
│   ├── home-security.service     # v2.home-security.uk stack: clone + docker compose up
│   ├── clamav-daily.{service,timer}   # freshclam + scan @03:30
│   ├── aide-daily.{service,timer}     # integrity check @04:15 (baseline init in finalize)
│   ├── container-update.{service,timer}  # image refresh, Sun @05:00
│   └── lynis-daily.{service,timer}     # system audit @03:00
└── 3_container_level/kasm/
    └── docker-compose.yaml   # three standalone KasmVNC workspaces (see below)
```

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

## Build

Requires: `butane`, `python3`. Defaults in parentheses.

```bash
export FCOS_SSH_PUBLIC_KEY='ssh-ed25519 ...'
export FCOS_CORE_PASSWORD_HASH='$6$...'        # openssl passwd -6
export FCOS_INTERFACE=ens3                     # verify via DHCP diag boot (ens2)
export FCOS_LAN_IP=192.168.1.201  FCOS_LAN_CIDR=192.168.1.0/24  FCOS_GATEWAY=192.168.1.1
./build.sh          # → vm-host.ign
DEPLOY=1 ./build.sh # also run diskless-os/ansible/playbooks/deploy-fcos-vm.yml
```

For full local deployment (inventory + run0 become on Secureblue) use
`diskless-os/ansible/deploy-fcos-vm-local.sh`; `DRY_RUN=1` prints the
generated files. `vm-host.ign` is fed to QEMU via `-fw_cfg` or
`coreos-installer ignition embed` on **first boot only**.

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
