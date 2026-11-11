---
name: containerized-fcos-provisioning
description: >
  Safely provision Fedora CoreOS VMs on a Libvirt/QEMU host from inside a
  container/Toolbox control plane using Butane, Ignition, virt-install, and
  optional Ansible. Use when building, reviewing, or running containerized
  FCOS provisioning (e.g. the vm-host/ flow), or when deciding where
  provisioning tooling should live relative to the hypervisor.
---

# Containerized FCOS Provisioning

Provision FCOS VMs with the container as **control plane only** — never run
the VM inside the container. The guest runs on host libvirt (`qemu:///system`)
with KVM; the container holds tools, downloads, and temp state so cleanup is
`podman rm` / deleting a project dir.

Reference implementation: `vm-host/` (`container/up.sh` → `deploy.sh` →
host `qemu:///system` on `br0`).

## Architecture rules

- Container = automation runner only (`butane`, `virt-install`, `virsh`,
  `qemu-img`, `curl`). Never nest the FCOS guest inside it.
- Connect to host libvirt via the mounted socket
  (`/run/libvirt/libvirt-sock` / `virtqemud-sock`); do not start a
  container-private libvirtd.
- Mount `/dev/kvm` for the precondition check (the VM itself is started by
  host virtqemud, not by the container).
- Keep the VM's disk/ignition paths on a host-visible mount at the **same
  absolute path** inside and outside the container — the domain XML
  references host paths.
- Treat FCOS as immutable: bootstrap once via Ignition (from Butane), then
  manage workloads (Kasm) via containers + systemd.

## Toolbox / host isolation

- Toolbox shares `$HOME`, user session, and D-Bus with the host — container
  actions can affect host virtualization resources. Prefer unprivileged
  `qemu:///system` access (user in `libvirt` group; sockets are
  `srw-rw-rw-`) over root inside the container where possible.
- If container-root is required (e.g. `qemu-img create` into a root-owned
  image dir), remember uid-mapping: `chown qemu:qemu` fails — skip it and
  let virtqemud assign disk ownership at domain start.
- Keep artifacts (base qcow2, overlays, `.ign`, XML) in a dedicated project
  dir (e.g. `~/fcos-vm` or repo `build/`), never loose in
  `/var/lib/libvirt/images` during development.
- SELinux: label mounts `:z`/`:Z` for container access; on the host run
  `restorecon` on qcow2/ignition files so QEMU isn't denied. Never disable
  SELinux (`selinux=0`) to work around volume permissions.
- Pin tool versions (butane, libvirt-client, virt-install, qemu-img) in the
  Containerfile/README so the provisioning env is rebuildable.

## Butane / Ignition safety

- `butane --strict` must pass with zero errors before booting; Ignition runs
  **once** — a bad `.ign` can brick first boot / lock out SSH.
- No plaintext secrets in version-controlled `.bu`: `ssh_authorized_keys`
  for access; app secrets injected post-boot (env files, vault).
- `chmod 600` generated `.ign` if it carries bootstrap secrets; remove temp
  copies after first boot.
- FCOS layout: `/usr` read-only (never write there), `/etc`+`/var`
  writable, `/opt` → `/var/opt`.
- Package layering: `rpm-ostree install` (NOT `--apply-live`) + one reboot;
  gate first-boot units with stamp files for idempotence.
- Network: verify guest NIC name on real boot (libvirt virtio → `ens2`,
  QEMU default → `ens3`) before locking `FCOS_INTERFACE`.

## Guest hardening checklist

- Zincati: configure update window/off-hours so the VM doesn't reboot
  mid-session (`zincati-updates.toml`).
- firewalld: expose only needed ports (Kasm HTTPS 443/8443, SSH 22 ideally
  admin-subnet only); keep docker bridges isolated.
- Suricata/clamscan/AIDE etc.: units must not set `NoNewPrivileges` if they
  exec `nft`/need DAC override; give `Group=` where required; writable
  `/var/log` + `/var/run` dirs; complete `vars` block in `--include`
  overrides (include replaces the whole map).
- Kasm: no GPU → KasmVNC falls back to llvmpipe; do NOT force DRI3 or pass
  `/dev/dri`. Standalone KasmVNC compose ≠ full Kasm server.
- Memory: Kasm is RAM-hungry — size VM RAM and guest swap accordingly;
  ensure `/var/lib/docker` + `/opt/kasm` have disk headroom.

## Ansible-from-container notes (if used later)

- Stock FCOS has no Python: use `raw`, or layer `python3` via rpm-ostree,
  or deploy declaratively (compose + systemd).
- Isolate test SSH host keys: `--ssh-common-args='-o
  UserKnownHostsFile=/tmp/fcos_known_hosts'` — don't disable verification.
- Encrypt secrets with `ansible-vault`; `--check --diff` before applying;
  `virsh snapshot-create-as` before upgrades.

## Pre-flight checklist

- [ ] `virsh -c qemu:///system list` works from inside the container without root
- [ ] `/dev/kvm` present; `br0` up with carrier on host
- [ ] `butane --strict` clean; no secrets in VCS `.bu` files
- [ ] Zincati window + swap defined; SELinux enforcing on host and guest
- [ ] Image/ignition paths identical inside container and on host
