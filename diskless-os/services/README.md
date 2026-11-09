# FCOS Service Configuration

Butane/Ignition writes the first-boot configuration, security policy, scripts and systemd units. Ansible layers required RPMs, reboots into the new deployment, runs the Suricata preparation gate, enables services, validates IDS/IPS and tests rootless Compose.

## Services

- **Firewalld:** public zone bound to the configured FCOS NIC (default enp1s0); inbound target DROP; SSH accepted only from the configured trusted LAN (default 192.168.1.0/24). Host-originated IPv4 egress uses HOST -> ANY, defaults to DROP and permits HTTP, HTTPS, DNS and NTP only from the explicit FCOS LAN address (default 192.168.1.201).
- **Suricata:** NFQUEUE queue 0 on host INPUT/OUTPUT for enp1s0; HOME_NET 192.168.1.0/24. The override includes suricata.rules and local.rules, and sets NFQ mode accept. The prepare unit runs suricata-update update-sources, enables free ET Open (et/open), updates rules and validates suricata -T -c /etc/suricata/suricata.yaml and then validates the active FCOS override before suricata.service starts.
- **ClamAV:** one daily clamav-scan.timer at 02:00. Its service starts the freshclam one-shot dependency before the read-only scan. No automatic deletion or quarantine.
- **Lynis:** daily system audit at 03:00.
- **AIDE:** daily integrity check at 04:00; timer remains disabled until a trusted baseline is initialized and reviewed.
- **Logrotate:** daily rotation with 30 retained compressed logs for ClamAV, Lynis and AIDE.
- **Rootless Podman:** user socket under /run/user/1000/podman/podman.sock, linger for core, CONTAINER_HOST and DOCKER_HOST exports, and interactive docker/docker-compose aliases. Rootful system Podman/Docker sockets are masked.

## Package prerequisites

The Ansible package-layering playbook installs firewalld, nftables, suricata, aide, clamav, clamav-freshclam, lynis, podman-compose and logrotate using rpm-ostree. Fedora's Suricata package supplies suricata-update. Podman and its user socket are expected from the FCOS base image. Butane does not install RPM packages.

## Operational details

- FCOS address defaults to 192.168.1.201/24 with gateway/DNS 192.168.1.1; reserve it in DHCP or adjust the Butane workflow inputs.
- The guest NIC defaults to enp1s0 and must match the FCOS VM's actual interface.
- NFQUEUE hooks use bypass deliberately (fail-open). Firewalld remains active if Suricata stops, but IPS inspection is unavailable; monitor Suricata service health.
- The configuration inspects traffic to/from FCOS, not general LAN transit traffic.
- Active IDS/IPS proof requires a controlled HTTP endpoint on the trusted LAN, TCP/80. The Ansible validation playbook injects temporary alert/drop rules, verifies EVE events and restores production rules.
- The Compose smoke test requires the exact image to be preapproved and pulled in FCOS rootless storage using the existing podwhitelist helper. The workflow refuses to pull images or change registry policy.
- Kasm is not installed by this workflow. The isolated Kasm POC checks Docker Engine identity and Docker Compose v2 requirements and fails closed when the endpoint identifies as Podman.

See Ansible operations and architecture.
