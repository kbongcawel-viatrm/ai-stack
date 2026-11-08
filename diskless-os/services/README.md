# FCOS Service Configuration

Butane/Ignition provides first-boot service configuration. Ansible validates the package set, manages the Suricata configuration and rules, coordinates package layering/reboots, and performs service/traffic validation.

## Services

- **Firewalld:** inbound default DROP on `enp1s0`; only SSH from `192.168.1.0/24`. Host-originated IPv4 egress is source-bound to FCOS LAN IP `192.168.1.20`, allowing HTTP/HTTPS, DNS and NTP.
- **Suricata:** NFQUEUE queue 0 on ingress/egress of `enp1s0`; HOME_NET `192.168.1.0/24`. Rule source `et/open`. Rules are updated and config-tested before service start/restart. NFQUEUE rules use fail-open `bypass`; monitor daemon health.
- **AIDE:** daily check at 04:00; timer intentionally disabled until a trusted baseline has been initialized and reviewed.
- **ClamAV:** signature update at 01:30 and read-only scan at 02:00; no auto-delete or quarantine.
- **Lynis:** daily system audit at 03:00.
- **Rootless Podman:** user socket enabled for `core`; Docker API variables and interactive aliases point to `/run/user/1000/podman/podman.sock`. Rootful API services are masked.

## Package prerequisites

The FCOS image must contain `firewalld`, `nftables`, Suricata with NFQUEUE support, `suricata-update`, AIDE, ClamAV, Lynis, Podman and `podman-compose`. Butane writes configuration and units; it does not install these packages. Use a tested custom image or package-layering/reboot phase before relying on the units.

See [Ansible operations](../ansible/README.md) and [architecture](../docs/architecture.md).
