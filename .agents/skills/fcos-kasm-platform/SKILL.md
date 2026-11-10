---
name: fcos-kasm-platform
description: "Planned modular architecture for scaling the Fedora CoreOS
  security/Kasm platform: composable Butane fragments merged via
  ignition.config.merge, tag-driven Ansible roles (butane_composer,
  qemu_provisioner, kasm_configurator), lightweight Kasm Workspaces (Alpine +
  Firefox), and Windows RDP Server workspaces. Use when modularizing
  diskless-os/butane, adding Kasm Workspaces, splitting services into
  feature-flagged modules, or planning multi-node FCOS deployments."
---

# FCOS + Kasm Platform — Modularization Plan

Status: **partially implemented (2026-11-10).** The monolithic `fcos.bu`
(verified working baseline, commit 347039e) was split into a base fragment
plus per-service fragments under `diskless-os/services/<svc>/<svc>.bu`,
composed by `diskless-os/butane/compose-bu.py` (`@@include` markers →
`ignition.config.merge` via generated `root.bu`). This matches the
`butane_modules` idea but lives in `services/` instead. Ansible roles
(`butane_composer`, `qemu_provisioner`, `kasm_configurator`) and feature
toggles remain unimplemented.

## Target repository layout

```text
fcos-kasm-platform/
├── inventory.ini
├── site.yml                      # master orchestrator, tag-driven phases
├── ansible.cfg
├── group_vars/
│   └── all.yml                   # feature toggles, network, images, disk
├── butane_modules/               # composable .bu / .bu.j2 fragments
│   ├── 00-base-system.bu         # users, SSH keys, static/DHCP networking
│   ├── 10-rpm-ostree.bu          # dynamic package layering + reboot guard
│   ├── 20-firewalld.bu           # zone lockdowns, per-service port rules
│   ├── 21-suricata.bu            # AF_PACKET/NFQUEUE config + update timer
│   ├── 22-clamav.bu              # freshclam init + twice-daily timer
│   ├── 23-aide.bu                # baseline init + daily integrity timer
│   └── 30-kasm-workspaces.bu     # Docker Engine + Kasm install
└── roles/
    ├── butane_composer/          # render modules, transpile, merge .ign
    ├── qemu_provisioner/         # QCOW2 base/overlay lifecycle, QEMU cmd
    └── kasm_configurator/        # post-boot SSH role: creds + Kasm API
```

## Key design decisions

### Composable Butane via `ignition.config.merge`

- Each module is a standalone valid Butane file, transpiled to an `.ign`
  fragment, then merged by a generated `root.bu`:

  ```yaml
  ignition:
    config:
      merge:
        - local: 00-base-system.ign
        - local: 10-rpm-ostree.ign
        {% if enable_suricata %}- local: 21-suricata.ign{% endif %}
  ```

- Transpile fragments with `butane --strict --files-dir=<fragdir>` so
  `local:` references resolve.

### Feature toggles drive both packages and modules

`group_vars/all.yml` toggles (`enable_firewalld`, `enable_suricata`,
`enable_clamav`, `enable_aide`, `enable_lynis`, `enable_kasm`,
`use_static_ip`) feed:

- `rpm_ostree_packages` list built dynamically (suricata, clamav,
  clamav-update, aide, firewalld, lynis, moby-engine, docker-compose)
- `enabled_bu_modules` list for rendering/merging

### Decoupled systemd ordering (replaces monolithic init scripts)

- `10-rpm-ostree`: owns `/var/lib/rpm-ostree-install.stamp`, triggers the
  single post-layering reboot.
- Each service module: `ConditionPathExists=/var/lib/rpm-ostree-install.stamp`
  plus its own `.stamp` file; units order `After=` the layer unit.
- Firewall rules move into per-module drop-ins/`ExecStartPre` instead of one
  central script.
- Parallel boot-2 init (freshclam + suricata-update run concurrently).

### Lightweight Kasm Workspaces (no GPU host)

- Seed-filter `conf/database/seed_data/default_images_amd64.yaml` down to
  `kasmweb/alpine-321-desktop` + `kasmweb/firefox` (optionally
  `kasmweb/ubuntu-noble-desktop`, `kasmweb/debian-bookworm-desktop`,
  `kasmweb/fedora-42-desktop`, `kasmweb/brave`, `kasmweb/chromium`,
  `kasmweb/vivaldi`), setting `cores: 1.0`, `memory: 1536000000` per image.
- `install.sh --accept-eula --no-swap-check` (FCOS has no swap; ZRAM only).
- **No DRI3 / no `/dev/dri` passthrough** — no GPU; KasmVNC falls back to
  MESA llvmpipe. Forcing DRI3 breaks workspace launches.
- Windows workspaces are NOT containers: register the Windows host as a
  Kasm **Server** (RDP) via Infrastructure → Servers, then create a
  `image_type: Server` workspace. Allow outbound TCP 3389 in firewalld.
- Retrieve generated admin creds: `journalctl -u kasm-install.service |
  grep -A5 "admin@kasm.local"`.

### qemu_provisioner role

- Idempotent: find/download FCOS base QCOW2 via
  `coreos-installer` container, create persistent overlay
  (`qemu-img create -f qcow2 -b base -F qcow2 overlay 100G`).
- Ignition via `-fw_cfg` only on FIRST boot of a fresh overlay; existing
  overlay boots without it.
- Auto-select networking: rootful + `br0` + `/etc/qemu/bridge.conf` →
  `-netdev bridge`; otherwise rootless `--network=passt` with hostfwd
  (SSH 2222, Kasm HTTPS 8443).
- KVM if `/dev/kvm` accessible, else `-cpu max` TCG.

### kasm_configurator role (post-boot, over SSH)

- `wait_for` the install stamp, scrape admin password from journald,
  authenticate to Kasm API (`https://<vm>` POST → api_key/api_key_secret),
  idempotently register Windows RDP target server + Server workspace.

### CI validation

`.github/workflows/validate-butane.yml`: matrix over feature-flag profiles
(Full+Kasm DHCP, Full+Kasm static IP, Kasm-only) running the composer role
with `butane --strict`, then asserting `build/config.ign` is valid JSON.

## Hard-won environment gotchas (verified on live VMs)

- **Guest NIC name is topology-dependent**: libvirt virtio-net at PCI
  slot 0x02 → `ens2`; QEMU-direct default slot → `ens3`; `enp1s0` is for
  non-virtio NICs. Always verify with a DHCP diag boot before locking
  `FCOS_INTERFACE`.
- **Host resolv.conf is `127.0.0.1` (dnsconfd)** — QEMU slirp (`-netdev
  user`) DNS proxy dies under load; use libvirt bridge/tap or passt for
  reliable guest DNS. TCP egress works even when DNS is dead.
- **`podman run quay.io/coreos/butane` is blocked** by the host's
  containers `policy.json` (only alpine/fedora-coreos/fedora-toolbox
  allowed). A static `/tmp/butane` binary (v0.23.0) exists for local
  transpilation.
- **Suricata needs**: `Group=suricata` on the unit (CapabilityBoundingSet
  drops CAP_DAC_OVERRIDE), traversable `/etc/suricata`, suricata-owned
  rules, writable `/var/log/suricata` + `/var/run/suricata`, and a
  **complete** `vars` block in `--include` overrides (the include
  replaces the whole map — missing `HTTP_SERVERS` etc. breaks all ET
  rules) plus the `%YAML 1.1`/`---` header.
- **`rpm-ostree install` (not `--apply-live`) + reboot** is required for
  package-owned `/etc` content; stamp gates re-runs.
- **`NoNewPrivileges` must stay off** units exec'ing `nft`/`suricata`
  (SELinux bounded-transition denial).
- LAN is `192.168.1.0/24` gw `192.168.1.1` on `br0`; `10.1.29.x` is dead.

## Scaling path

- Per-node profiles via inventory groups (all-in-one vs Kasm agent
  workers) — same modules, different toggles.
- At scale: move `10-rpm-ostree` into a GitHub Actions FCOS image build
  (`FROM quay.io/fedora/fedora-coreos:stable` + `rpm-ostree install`),
  rebase Butane modules onto the signed image — eliminates boot-time
  package downloads.
