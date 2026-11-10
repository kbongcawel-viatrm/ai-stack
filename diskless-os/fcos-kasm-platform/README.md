# FCOS Kasm POC package layer

This directory contains a small modular Butane configuration for host-level
FCOS services. Suricata and ClamAV are installed as RPM-layered system packages;
their systemd units/configuration run on the FCOS guest, not in a container.
AIDE and Lynis are not layered onto the host; they can be deployed as containers
through the rootless Podman/Quadlet setup if needed.

- `00-package-layer.bu` stages FCOS packages with `rpm-ostree` on first boot and
  reboots into the staged deployment. Fedora CoreOS does not support a Butane
  `packages` field.
- `root.bu` merges the transpiled package fragment through
  `ignition.config.merge`.
- Host package layer includes the existing FCOS prerequisites plus Suricata and
  ClamAV; it excludes AIDE and Lynis. This does not yet define AIDE/Lynis
  containers or their Quadlet units.
- Kasm is deliberately **not** installed: this POC uses rootless Podman, while
  Kasm requires Docker Engine. The existing compatibility playbook fails closed
  on a Podman endpoint.

## Build

Run from this directory with Butane 0.23 or a compatible strict-mode release:

```bash
butane --strict --pretty 00-package-layer.bu > 00-package-layer.ign
butane --strict --pretty --files-dir . root.bu > fcos-kasm-platform.ign
```

The generated `.ign` files are build artifacts; do not edit them by hand. Review
the final Ignition JSON before supplying it to a VM. The package-layer unit
changes the guest's rpm-ostree deployment and reboots that guest on first boot;
it does not install or modify software on the build host.