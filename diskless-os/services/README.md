# FCOS Service Configuration

Each service lives in its own directory and owns a modular Butane fragment
(`<service>/<service>.bu`) plus the payload scripts and config files it
installs. `diskless-os/butane/compose-bu.py` inlines the payload files into
the fragments via `@@include` markers and generates `root.bu`, which merges
all fragments (base `fcos.bu` + every service fragment) through
`ignition.config.merge`. See `diskless-os/butane/README.md` for the build.

Every service fragment installs its `/usr/local/sbin` scripts and runs
first-boot `provision-<service>.service` oneshot units (after
`fcos-package-layer.service` and `fcos-services-preflight.service`) that
validate or seed the service environment. Recurring work stays in timers
(ClamAV scan, Lynis audit, AIDE check, Suricata rule refresh).

Butane/Ignition writes the first-boot configuration, security policy, scripts and systemd units, including the rpm-ostree package layer installed and activated via first-boot reboot. Ansible configures and validates services, runs the Suricata preparation gate, enables services, validates IDS/IPS and tests rootless Compose.

## Layout

| Directory | Fragment | Boot payload(s) |
|---|---|---|
| `ssh/` | `ssh.bu` | `provision-ssh.sh` (sshd -t validation) + `00-local-security.conf` drop-in (publickey-only globally; password auth allowed for sources in the trusted LAN CIDRs as break-glass) |
| `firewalld/` | `firewalld.bu` | `provision-firewalld.sh` (policy verification), `fcos-bootstrap.nft`, zone/policy XML, service drop-ins; `harden-firewalld.sh` is a generic-host CIS script, not used by FCOS |
| `suricata/` | `suricata.bu` | `suricata-prepare.sh` (update+validate gate), `suricata-rule-refresh.sh` (weekly timer), `fcos-overrides.yaml`, `suricata-nfq.nft`, `local.rules` |
| `clamav/` | `clamav.bu` | `provision-clamav.sh` (env check + one-time DB seed), `clamav-daily-scan.sh` |
| `lynis/` | `lynis.bu` | `provision-lynis.sh` (env check), `lynis-daily-audit.sh`; `install-lynis-daily.sh` is a generic-host installer, not used by FCOS |
| `aide/` | `aide.bu` | `provision-aide.sh` (env check, never initializes baseline), `aide-daily-check.sh` |

`compose.yaml` is a rootless Podman Compose smoke test, not a boot service.

## Services

- **Firewalld:** public zone bound to the guest NIC via the NetworkManager connection's zone setting (interface-name agnostic); inbound target DROP; SSH accepted only from the configured trusted LAN (default 192.168.1.0/24). Host-originated IPv4 egress uses HOST -> ANY, defaults to DROP and permits HTTP, HTTPS, DNS and NTP only from the explicit FCOS LAN address (default 192.168.1.201).
- **Suricata:** NFQUEUE queue 0 on host INPUT/OUTPUT for all non-loopback interfaces; HOME_NET 192.168.1.0/24. The override includes suricata.rules and local.rules, and sets NFQ mode accept. The prepare unit runs suricata-update update-sources, enables free ET Open (et/open), updates rules and validates suricata -T -c /etc/suricata/suricata.yaml and then validates the active FCOS override before suricata.service starts.
- **ClamAV:** one daily clamav-scan.timer at 02:00. Its service starts the freshclam one-shot dependency before the read-only scan. No automatic deletion or quarantine.
- **Lynis:** daily system audit at 03:00.
- **AIDE:** daily integrity check at 04:00; timer remains disabled until a trusted baseline is initialized and reviewed.
- **Logrotate:** daily rotation with 30 retained compressed logs for ClamAV, Lynis and AIDE.
- **Rootless Podman:** user socket under /run/user/1000/podman/podman.sock, linger for core, CONTAINER_HOST and DOCKER_HOST exports, and interactive docker/docker-compose aliases. Rootful system Podman/Docker sockets are masked.

## Package prerequisites

The Butane first-boot oneshot fcos-package-layer.service installs firewalld, nftables, suricata, aide, clamav, clamav-freshclam, lynis, podman-compose and logrotate using rpm-ostree install --idempotent --allow-inactive, then reboots into the staged deployment. Ansible playbooks configure and validate these services but do not install packages. Fedora's Suricata package supplies suricata-update. Podman and its user socket are expected from the FCOS base image.

## Operational details

- FCOS address defaults to 192.168.1.201/24 with gateway/DNS 192.168.1.1; reserve it in DHCP or adjust the Butane workflow inputs.
- The guest NIC name is hypervisor-dependent; the Butane config binds by connection/zone and nft rules match all non-loopback interfaces, so no interface name needs to be configured.
- NFQUEUE hooks use bypass deliberately (fail-open). Firewalld remains active if Suricata stops, but IPS inspection is unavailable; monitor Suricata service health.
- The configuration inspects traffic to/from FCOS, not general LAN transit traffic.
- Active IDS/IPS proof requires a controlled HTTP endpoint on the trusted LAN, TCP/80. The Ansible validation playbook injects temporary alert/drop rules, verifies EVE events and restores production rules.
- The Compose smoke test requires the exact image to be preapproved and pulled in FCOS rootless storage using the existing podwhitelist helper. The workflow refuses to pull images or change registry policy.
- Kasm is not installed by this workflow. The isolated Kasm POC checks Docker Engine identity and Docker Compose v2 requirements and fails closed when the endpoint identifies as Podman.

See Ansible operations and architecture.
