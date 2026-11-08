# FCOS Service Configuration

Butane/Ignition writes the first-boot configuration and systemd units. Ansible layers the required RPMs, reboots into the package deployment, enables rootless Podman, updates Suricata rules, activates gated services and validates traffic.

## Services

- **Firewalld:** public zone bound to enp1s0; inbound target DROP; SSH accepted only from 192.168.1.0/24. Host-originated IPv4 egress uses HOST -> ANY, defaults to DROP and permits HTTP, HTTPS, DNS and NTP only from FCOS address 192.168.1.20.
- **Suricata:** NFQUEUE queue 0 on host INPUT/OUTPUT for enp1s0; HOME_NET 192.168.1.0/24. Sources are refreshed with suricata-update update-sources, free Emerging Threats Open (et/open) is enabled, rules are updated and suricata -T runs before suricata-nfq.service is enabled.
- **AIDE:** daily check at 04:00; timer remains disabled until a trusted baseline is initialized and reviewed.
- **ClamAV:** freshclam update at 01:40 and read-only scan at 02:00. The initial scan scope is /var/home/core; no automatic deletion or quarantine.
- **Lynis:** daily system audit at 03:00.
- **Rootless Podman:** user socket under /run/user/<UID>/podman/podman.sock, linger for core, CONTAINER_HOST export, docker and docker-compose aliases, plus executable wrappers.

## Package prerequisites

The FCOS deployment must contain firewalld, nftables, suricata, aide, clamav, clamav-freshclam, lynis and podman-compose. Fedora's suricata package supplies suricata-update. Podman is expected from the FCOS base image. Butane does not install RPM packages; the Ansible provisioning playbook layers missing packages and reboots before activating the services.

## Operational details

- FCOS address 192.168.1.20 must be static or DHCP-reserved. The Firewalld egress policy is source-bound to this address.
- The interface name enp1s0 must match the FCOS guest NIC.
- NFQUEUE hooks use queue-bypass deliberately (fail-open). Firewalld remains active if Suricata stops, but IPS inspection is then unavailable.
- This configuration inspects traffic to/from FCOS, not general LAN transit traffic.
- IDS/IPS proof requires a separate LAN HTTP test endpoint and the validate-suricata Ansible playbook.
- Kasm is not enabled by this Compose/runtime setup. Docker CLI and Compose compatibility are necessary but insufficient proof for Kasm; run the isolated Kasm POC before any production Kasm deployment.

See [Butane configuration](../butane/README.md), [Ansible operations](../ansible/README.md) and [architecture](../docs/architecture.md).
