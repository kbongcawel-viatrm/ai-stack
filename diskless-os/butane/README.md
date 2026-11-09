# FCOS Butane Configuration

fcos.bu is the first-boot configuration source for the FCOS guest. The Deploy Host VM workflow substitutes the five explicit deployment variables, transpiles Butane in strict mode and passes the resulting Ignition configuration to QEMU through fw_cfg.

## Deployment variables

| Variable | Default | Purpose |
|---|---|---|
| FCOS_SSH_PUBLIC_KEY | Required | Public key for FCOS core |
| FCOS_LAN_IP | 10.1.29.201 | Static guest IPv4 address |
| FCOS_LAN_CIDR | 10.1.29.0/24 | Trusted LAN and Suricata HOME_NET |
| FCOS_GATEWAY | 10.1.29.2 | Default gateway and DNS |
| FCOS_INTERFACE | enp1s0 | Guest NIC |

The workflow uses an envsubst variable allowlist. Do not substitute every shell variable in embedded scripts; that would corrupt shell expressions such as BASH_VERSION.

## Provisioned by Butane/Ignition

- **SSH:** core public-key authentication, password and keyboard-interactive authentication disabled, root remote login only by key, forwarding/tunneling disabled, bounded login grace and authentication retries.
- **NetworkManager:** static IPv4 on the configured NIC, configured gateway/DNS, IPv6 disabled in this profile.
- **Kernel/sysctl:** disables IP forwarding and applies network, ptrace, BPF, kexec, core-dump and kernel-information hardening. Review these settings before changing the workload; they are intended for a host VM, not a general router.
- **Firewalld:** public zone on the FCOS NIC, inbound target DROP, SSH only from FCOS_LAN_CIDR; fcos-host-egress is a HOST -> ANY policy with default DROP and source FCOS_LAN_IP. It permits HTTP/HTTPS, DNS and NTP, including explicit TCP 80/443 and DNS/NTP ports.
- **Suricata:** FCOS override sets HOME_NET, EXTERNAL_NET, suricata.rules plus local.rules, NFQ mode accept, EVE logging and queue 0. nftables hooks queue host INPUT/OUTPUT traffic on the configured NIC at priority -150, with queue bypass.
- **Suricata startup gate:** suricata.service requires both suricata-prepare.service and suricata-nfq-rules.service. The prepare script runs package preflight, suricata-update update-sources, enables free ET Open (et/open), updates rules and runs the base config test and then the config test with the FCOS override. A failed update/test restores the previous rules directory and prevents Suricata startup.
- **Rule refresh:** weekly timer reruns the transactional update/test sequence and restarts Suricata only after validation succeeds.
- **ClamAV:** one daily clamav-scan.timer at 02:00. The scan service starts the freshclam one-shot dependency first, then performs a read-only scan of /etc, /usr, /opt and /var/home. No automatic deletion or quarantine. The separate freshclam timer is disabled to avoid a second daily update.
- **Lynis:** daily audit at 03:00.
- **AIDE:** daily check at 04:00. Its timer is disabled until a trusted baseline is initialized and explicitly reviewed.
- **Logrotate:** daily rotation for ClamAV, Lynis and AIDE logs.
- **Rootless Podman:** rootless user socket for core UID 1000, linger, CONTAINER_HOST and DOCKER_HOST exports, and interactive docker/docker-compose aliases. Rootful system Podman/Docker sockets are masked.
- **Preflight:** systemd service checks that required binaries and Suricata NFQUEUE support exist before security services start.

Butane writes files, policy and systemd units. It does not install RPM packages, download signatures, initialize an AIDE database, or prove packet inspection. Ansible layers missing RPMs and coordinates service activation/reboot.

## Operational gates

1. Confirm the FCOS static IP and interface match the DHCP reservation and Ansible inventory.
2. Preserve console recovery before applying the default-DROP firewall and SSH hardening.
3. Layer packages and reboot FCOS before relying on the services.
4. Confirm Firewalld public target is DROP and its only inbound exception is LAN SSH. Kasm HTTPS ingress is intentionally not opened.
5. Confirm the egress policy contains the explicit FCOS source IP, HTTP/HTTPS services and TCP 80/443 ports.
6. Run suricata -T -c /etc/suricata/suricata.yaml --include /etc/suricata/fcos-overrides.yaml. The Ansible prepare unit performs the initial update/test before Suricata starts.
7. Validate IDS alerting and IPS dropping with a separate controlled HTTP endpoint on the trusted LAN. Service status alone is not proof.
8. Initialize AIDE once, review the baseline, then run enable-aide-check.yml. Never automatically rebaseline after an unexplained change.
9. Verify podman info reports rootless: true and the remote socket points to the FCOS core user's runtime directory. A Toolbox connected to the host socket is not FCOS validation.

## Render and validate

Set FCOS_SSH_PUBLIC_KEY, FCOS_LAN_IP, FCOS_LAN_CIDR, FCOS_GATEWAY and FCOS_INTERFACE in the environment. Render only those variables with envsubst, then run the strict Butane container transpiler. The repository validation workflow performs this operation automatically.
