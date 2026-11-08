# Ansible Operations

Ansible configures the FCOS guest after its base image has booted and SSH is reachable. Butane/Ignition owns first-boot files, systemd units, timer definitions, SSH policy, firewalld policy, NFQUEUE rules and rootless Podman user-socket defaults. Ansible owns package layering/reboot coordination, Suricata configuration/rule validation, AIDE baseline initialization workflow, service validation and health checks.

## Butane package contract

The Butane config expects these commands and units to exist in the FCOS deployment before service activation:

- `firewalld`, `firewall-cmd`, `nft`
- `suricata` built with NFQUEUE support and `suricata-update`
- `aide`
- `clamscan`, `freshclam`
- `lynis`
- `podman`, `podman-compose`, and `/usr/lib/systemd/user/podman.socket`

Butane does not install RPMs. Supply these through a tested custom FCOS image or an explicit `rpm-ostree install` package-layering phase followed by a reboot. Do not enable the security service units on an unprepared stock image and assume the executables exist. Package layering is a separate operation from rootless Podman use; the Podman engine remains rootless.

The deployment inventory must set `fcos_lan_ip` to the actual FCOS address. The checked-in Butane default is `192.168.1.20`; reserve that address in DHCP or update the Butane policy before provisioning. `enp1s0` is the configured interface and must match the guest NIC name.

## Rootless Podman and Docker compatibility

Butane:
- Enables the user-level `podman.socket` globally for user managers.
- Enables lingering for `core`.
- Exports `CONTAINER_HOST` and `DOCKER_HOST` as `unix:///run/user/1000/podman/podman.sock`.
- Adds interactive aliases: `docker='podman --remote --url "${CONTAINER_HOST}"'` and `docker-compose='podman-compose'`.
- Masks the rootful system-level Podman and Docker services/sockets.

The API socket must remain a Unix socket under the `core` user's runtime directory. Do not expose it over TCP. Aliases are interactive conveniences; automation must use explicit `CONTAINER_HOST`/API settings.

## SSH policy

Firewalld permits inbound SSH only from `192.168.1.0/24`; sshd requires public-key authentication and disables password/keyboard-interactive authentication. Root SSH is key-only. Provision the core user's public key using the `FCOS_SSH_PUBLIC_KEY` secret before boot. Keep console access and validate the allowed source before applying the policy.

## Firewalld

- Public zone is bound to `enp1s0` with target `DROP`.
- Only SSH from `192.168.1.0/24` is accepted inbound.
- Host-originated IPv4 egress uses the `HOST -> ANY` policy and is source-bound to `192.168.1.20`.
- Allowed egress: HTTP, HTTPS, DNS and NTP; ports 80/tcp and 443/tcp are explicitly listed as well.
- Other host-originated IPv4 egress is dropped. Add any required package, monitoring or VPN ports explicitly and narrowly.

This is a host egress policy. It does not automatically restrict all rootless container or forwarded traffic. Validate container egress separately.

## Suricata NFQUEUE

- Interface: `enp1s0`
- `HOME_NET`: `192.168.1.0/24` (set in the Ansible-managed Suricata YAML)
- NFQUEUE number: `0`
- Rule source: Emerging Threats Open (`et/open`)
- Rule refresh: weekly at 03:30, with config test before restarting the service.
- First boot: update sources, enable `et/open`, update rules, run `suricata -T -c /etc/suricata/suricata.yaml`, then start `suricata.service`.

The nftables rules queue host traffic entering/leaving `enp1s0`. They use `bypass` deliberately so a Suricata crash does not sever management networking; this is fail-open and means IPS inspection is absent while Suricata is down. Alert on a failed/inactive Suricata service.

A running daemon is not proof of IDS/IPS. Post-validation must verify:
1. `suricata --build-info` includes NFQ.
2. `suricata.service` is active and the nftables queue table/rules exist.
3. A controlled IDS test signature produces an EVE alert.
4. A controlled IPS test signature drops a packet on a reachable second LAN endpoint.
5. Normal SSH/DNS/HTTP/HTTPS connectivity remains functional.

Do not claim transit-LAN IPS: this configuration inspects traffic to/from the FCOS host. Transit traffic requires FCOS routing/bridging or mirrored traffic and a separately validated FORWARD queue.

## Daily scan services

| Service/timer | Schedule | Log location | Safety behavior |
|---|---:|---|---|
| ClamAV signature update | 01:30 | ClamAV database logs | Freshclam only |
| ClamAV scan | 02:00 | `/var/log/clamav` | No automatic deletion/quarantine |
| Lynis audit | 03:00 | `/var/log/lynis` | Daily audit/report |
| AIDE check | 04:00 | `/var/log/aide` | Timer disabled until baseline reviewed |

All schedules use `Persistent=true` and randomized delay. AIDE's timer is intentionally disabled. Initialize and review the baseline manually after trusted provisioning, then enable it with:

```bash
sudo aide --init
sudo install -o root -g root -m 0600 /var/lib/aide/aide.db.new.gz /var/lib/aide/aide.db.gz
sudo systemctl enable --now aide-check.timer
```

Confirm the actual database paths from `/etc/aide.conf` before running these commands. Never automatically initialize or replace the baseline after unexplained changes.

## Validation commands

```bash
ansible-playbook -i inventory/hosts.yml playbooks/configure-security.yml --syntax-check
ansible-lint playbooks/configure-security.yml
ansible-playbook -i inventory/hosts.yml playbooks/configure-security.yml --check --diff
ansible-playbook -i inventory/hosts.yml playbooks/configure-security.yml --diff
ansible-playbook -i inventory/health.yml playbooks/health-check.yml
```
