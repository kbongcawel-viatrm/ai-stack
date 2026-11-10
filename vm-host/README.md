# vm-host — Provision & Harden Fedora CoreOS with Kasm Workspaces

Modular, repeatable FCOS provisioning split across three levels. Every
config file lives as a **raw fragment** — edit the fragment, re-run
`build.sh`, boot the result. Nothing is embedded in a monolith.

## Layout

```text
vm-host/
├── build.sh                  # variable substitution + butane --strict transpile
├── config.bu                 # root Butane config; pulls fragments via contents: local:
├── 1_host_level/             # host hardening (files installed to /etc)
│   ├── sshd-hardening.conf   # → /etc/ssh/sshd_config.d/00-vm-host-security.conf
│   ├── journald-hardening.conf
│   ├── sysctl-kasm.conf      # kernel hardening + container/Kasm sysctls
│   ├── zincati-updates.toml   # FCOS autoupdate window (Sun 04:00–06:00)
│   └── files/
│       ├── aide/aide.conf
│       ├── clamav/freshclam.conf
│       ├── suricata/suricata.yaml  # --include overrides; full vars map (see gotchas)
│       ├── suricata/suricata.rules # local rules
│       └── firewalld/firewall-rules.xml  # default-DROP zone; SSH/Kasm 8443 from LAN only
├── 2_systemd_level/          # systemd units (installed verbatim)
│   ├── security-setup.service    # 1st boot: rpm-ostree layer + hardening + reboot (stamp-gated)
│   ├── kasm-workspace.service    # Kasm install/lifecycle: install.sh once, then compose up
│   ├── clamav-daily.*{service,timer}      # signature update + read-only scan @02:00
│   ├── aide-daily.*{service,timer}        # integrity check @04:00 (baseline is manual)
│   ├── container-update.{service,timer}   # workspace image pull/refresh, Sun @03:30
│   └── lynis-daily.{service,timer}         # system audit @03:00
└── 3_container_level/kasm/
    └── docker-compose.yaml    # lightweight workspace image set (alpine + firefox, 1 CPU / 1.5 GiB each)
```

## Build

Requires: `butane`, `envsubst` (gettext), `jq`.

```bash
export FCOS_INTERFACE=ens3                                   # verify via DHCP diag boot: virtio slot 0x02 → ens2, QEMU default → ens3
export FCOS_LAN_IP=192.168.1.50
export FCOS_LAN_CIDR=192.168.1.0/24
export FCOS_GATEWAY=192.168.1.1
export FCOS_CORE_PASSWORD_HASH='$6$...'                     # openssl passwd -6
export FCOS_SSH_PUBLIC_KEY='ssh-ed25519 AAAA...'
export KASM_ADMIN_PASSWORD='...'                            # or use installer output instead
./build.sh    # → build/config.ign
```

`build/config.ign` is fed to QEMU via `-fw_cfg` or to `coreos-installer
ignition embed` on **first boot only** (per the qemu_provisioner design: a
persistent overlay does not get Ignition on subsequent boots).

## Cluster notes (from the fcos-kasm-platform design)

- **Single layering reboot**: `security-setup.service` owns
  `/var/lib/vm-host/vm-host-setup.stamp`; all other units gate on it.
  `rpm-ostree install` (not `--apply-live`) + reboot is required for
  package-owned `/etc` content.
- **No GPU / no `/dev/dri` passthrough** — KasmVNC falls back to MESA
  llvmpipe; forcing DRI3 breaks workspace launches.
- **Kasm install**: `install.sh --accept-eula --no-swap-check` (FCOS has
  no swap; ZRAM only). Admin creds land in the journal:
  `journalctl -u vm-host-kasm-workspace.service | grep -A5 "admin@kasm.local"`.
- **Suricata overrides** are passed with `--include`, which replaces the
  whole `vars` map — every ET-referenced group is redeclared in
  `1_host_level/files/suricata/suricata.yaml` (with the `%YAML 1.1` header).
  `NoNewPrivileges` must stay off units exec'ing `nft`/`suricata`
  (SELinux bounded-transition denial).
- **AIDE baseline is manual**: initialize with
  `aide --init && mv /var/lib/aide/aide.db.new.gz /var/lib/aide/aide.db.gz`
  after first review; `aide-daily.timer` only verifies.
- **Windows workspaces are not containers**: register the Windows host as
  a Kasm *Server* (RDP) under Infrastructure → Servers and allow outbound
  TCP 3389 in the firewalld zone.
- Host DNS quirk applies to this network: SLIRP DNS is unreliable
  (`127.0.0.1` host resolv.conf via dnsconfd); use bridge/passt for the
  guest network, matching the static `.nmconnection` in `config.bu`.
