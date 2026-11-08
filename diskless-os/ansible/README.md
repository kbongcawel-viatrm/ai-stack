# Ansible Operations

Ansible configures the FCOS guest after its base image has booted and SSH is reachable. Butane/Ignition owns first-boot configuration; Ansible handles package layering/reboot coordination, rule updates, active validation and health checks.

## Playbooks

| Playbook | Purpose |
|---|---|
| `layer-fcos-packages.yml` | Layer Firewalld, nftables, Suricata, AIDE, ClamAV, Lynis, podman-compose and logrotate with rpm-ostree; reboot only when a deployment is staged |
| `configure-security.yml` | Validate FCOS identity/NIC, Firewalld, SSH, Suricata NFQUEUE/rules, rootless Podman API and daily timers |
| `suricata-ips-validation.yml` | Add temporary IDS/IPS signatures, generate controlled HTTP traffic, verify EVE alerts/drop, restore production rules |
| `podman-compose-poc.yml` | Verify a preapproved local image, start an HTTP Compose stack through rootless Podman, test it and remove it |
| `kasm-compatibility-poc.yml` | Check Docker Engine and Docker Compose v2 requirements; fail closed before the Kasm installer if the endpoint is Podman |
| `deploy-fcos-vm.yml` | Provision FCOS on an existing libvirt hypervisor; refuses existing VM domains and orphaned disks |
| `health-check.yml` | Check hypervisor/KVM/VM state, FCOS services/timers, firewall, Suricata, AIDE timer state and rootless Podman |
| `initialize-aide.yml` | Explicitly initialize a missing AIDE baseline; refuses to overwrite an existing database and leaves the timer disabled |
| `enable-aide-check.yml` | Enable daily AIDE checks only after an explicit approval reason and successful baseline check |

## Butane package contract

The Butane config expects these commands and units to exist in the FCOS deployment before service activation:

- `firewalld`, `firewall-cmd`, `nft`
- `suricata` built with NFQUEUE support and the `suricata-update` command
- `aide`
- `clamscan`, `freshclam`
- `lynis`
- `podman`, `podman-compose`, and `/usr/lib/systemd/user/podman.socket`
- `logrotate`

Butane writes files, policy and systemd units; it does not install RPMs. The package-layering playbook installs the Fedora packages through rpm-ostree and reboots only if a new deployment is staged. The rootless Podman engine remains rootless.

## Butane-managed first boot

Butane/Ignition configures:

- Core user's public SSH key; password and keyboard-interactive SSH are disabled.
- NetworkManager static IPv4 identity on the configured guest NIC (default `enp1s0`), with the configured gateway/DNS.
- Firewalld default-DROP inbound zone; SSH is the only inbound exception and is restricted to `192.168.1.0/24`.
- A `HOST -> ANY` Firewalld egress policy bound to the explicit FCOS source IP; HTTP/HTTPS, DNS and NTP are allowed. TCP 80/443 are explicit.
- Suricata `HOME_NET`, NFQUEUE mode and local rule file; nftables queue rules on ingress/egress of the configured NIC.
- Suricata rule preparation, configuration test, service start ordering and weekly free-rule refresh.
- Daily ClamAV signature update at 01:30 and read-only scan at 02:00; no automatic delete/quarantine.
- Daily Lynis audit at 03:00.
- Daily AIDE check at 04:00, with its timer disabled until the trusted baseline is initialized and reviewed.
- Log rotation for ClamAV, Lynis and AIDE logs.
- Rootless Podman user socket, linger, `CONTAINER_HOST`, `DOCKER_HOST`, interactive `docker` and `docker-compose` aliases.
- Rootful system Podman/Docker socket activation is masked.

The static guest address must match the DHCP reservation and the egress policy. Defaults are FCOS `192.168.1.20/24`, gateway/DNS `192.168.1.1`, LAN `192.168.1.0/24`, NIC `enp1s0`. The VM workflow renders these as Butane variables.

## Firewalld behavior

- Inbound defaults to DROP.
- SSH from `192.168.1.0/24` is the only inbound exception. If you require zero inbound services, remove that rich rule and retain console access.
- Host-originated IPv4 egress is source-bound to the FCOS LAN IP and permits HTTP, HTTPS, DNS and NTP.
- Other host-originated IPv4 egress is dropped. Add required ports explicitly and narrowly.
- This is not a complete container/forwarding egress policy. Validate rootless container traffic separately.

## Suricata NFQUEUE behavior

- Interface: `enp1s0` by default.
- HOME_NET: `192.168.1.0/24` by default.
- NFQUEUE number: `0`.
- Rule source: Emerging Threats Open (`et/open`).
- Boot sequence: update sources, enable ET Open, update rules, run `suricata -T -c /etc/suricata/suricata.yaml --include /etc/suricata/fcos-overrides.yaml`, then start the NFQUEUE service.
- Weekly rule refresh validates configuration before restarting Suricata. A failed update restores the previous rules directory.
- nftables uses queue bypass to preserve management connectivity if Suricata stops. This is fail-open; inspection is absent while the service is down, so monitor service health.
- The chains inspect traffic to/from the FCOS host. They do not inspect arbitrary traffic between other LAN clients; transit IPS needs routing/bridging or mirrored traffic and a separate FORWARD queue design.

The active validation playbook requires a controlled HTTP server on TCP/80 inside `192.168.1.0/24`. It adds temporary IDS/IPS rules, verifies EVE alert IDs and restores the original generated rule file even when a test fails.

## Rootless Podman and Docker compatibility

Butane:
- Enables the user-level `podman.socket` for the `core` user.
- Enables lingering for `core`.
- Exports `CONTAINER_HOST` and `DOCKER_HOST` as `unix:///run/user/1000/podman/podman.sock`.
- Adds interactive aliases for `docker` and `docker-compose`.
- Masks rootful system-level Podman and Docker services/sockets.

The API socket remains a Unix socket under the `core` user's runtime directory. Do not expose it over TCP. Aliases are interactive conveniences; automation uses explicit socket URLs.

### Registry approval and Compose smoke test

The Compose POC does not change registry trust policy and does not pull images. It requires the exact image to already exist in FCOS rootless storage. Before running Provision Services/Containers, use the existing `podwhitelist` function in the FCOS user's shell to approve and pull the selected image, then pass the exact image reference as `container_smoke_image`. The playbook checks that image exists and refuses to pull an unapproved image.

The repository does not hard-code or reimplement the local `podwhitelist` function. To automate that exact function call inside the workflow, its function body and argument syntax must be added to the project.

## Kasm compatibility gate

The Kasm POC targets an isolated FCOS test VM, not the production guest. It verifies:
1. Docker CLI/server identity.
2. Docker Engine version (minimum currently pinned in the playbook).
3. Docker Compose v2 command and version.
4. Rootless Podman API identity.

If the endpoint identifies as Podman or lacks Docker Compose v2, the playbook fails closed and does not run the Kasm installer. Passing the basic Compose smoke test is not equivalent to Kasm compatibility. Production Kasm remains blocked until the official installer, services, volumes, networking, HTTPS and workspace lifecycle pass on the isolated VM.

## AIDE baseline

The AIDE timer is intentionally disabled. After trusted provisioning, inspect `/etc/aide.conf` and initialize/review the database using the paths configured by that file. On the current Fedora package defaults, the database is expected under `/var/lib/aide`; confirm the actual `DBDIR` and `database_out` before copying the new baseline into place.

Never automatically initialize or replace an AIDE baseline after unexplained changes.

## Workflow separation

| GitHub Actions workflow | Scope | Prerequisite |
|---|---|---|
| Deploy Host OS | Build and publish Alpine diskless iPXE assets/apkovl | PXE server, protected SSH publisher credentials |
| Deploy Host VM | Create FCOS VM on a prepared hypervisor | Existing KVM/QEMU/libvirt host, bridge, pinned QCOW2 URL/SHA |
| Provision Services/Containers | Layer packages, configure FCOS, validate IDS/IPS, test rootless Compose | Reachable FCOS VM, test HTTP endpoint, preapproved image |
| Health Check | Run Ansible hypervisor and FCOS checks | Host/FCOS SSH credentials and pinned known_hosts |
| Kasm Compatibility POC | Run Docker API/Compose gate on isolated FCOS VM | Isolated test VM and separate SSH credentials |

Deploy Host VM does not depend on Deploy Host OS. The selected host OS may be Alpine (default), Fedora Secureblue, Arch Linux or Ubuntu, provided the hypervisor is already prepared.

## Required GitHub configuration

### Repository variables

- `HYPERVISOR_HOST`, `HYPERVISOR_USER`, `HOST_OS`
- `FCOS_VM_IP`, `FCOS_SSH_USER`, `FCOS_LAN_IP`, `FCOS_LAN_CIDR`, `FCOS_INTERFACE`
- `PXE_HTTP_BASE_URL`

### Repository secrets / protected environments

- `HYPERVISOR_SSH_PRIVATE_KEY`, `HYPERVISOR_KNOWN_HOSTS`
- `FCOS_SSH_PUBLIC_KEY`, `FCOS_SSH_PRIVATE_KEY`, `FCOS_KNOWN_HOSTS`
- `ALPINE_SSH_PUBLIC_KEY`
- `PXE_HOST`, `PXE_USER`, `PXE_SSH_PRIVATE_KEY`, `PXE_KNOWN_HOSTS`, `PXE_HTTP_ROOT`
- For health checks: `HEALTH_KNOWN_HOSTS`, optional `AIDE_ENABLE_DAILY_TIMER` (set to `true` only after baseline approval)
- For Kasm POC: `KASM_POC_FCOS_IP`, `KASM_POC_SSH_USER`, `KASM_POC_SSH_PRIVATE_KEY`, `KASM_POC_KNOWN_HOSTS`

Use protected GitHub environments `pxe-production`, `host-vm-production`, `fcos-production` and `kasm-poc` with required reviewers.

## Local validation

```bash
ansible-playbook -i inventory/hosts.yml playbooks/layer-fcos-packages.yml --syntax-check
ansible-playbook -i inventory/hosts.yml playbooks/configure-security.yml --syntax-check
ansible-playbook -i inventory/hosts.yml playbooks/suricata-ips-validation.yml --syntax-check
ansible-playbook -i inventory/hosts.yml playbooks/podman-compose-poc.yml --syntax-check
ansible-playbook -i inventory/hosts.yml playbooks/health-check.yml --syntax-check
ansible-lint playbooks/
```
