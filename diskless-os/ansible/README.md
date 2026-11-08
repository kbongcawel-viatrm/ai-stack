# Ansible Operations

Ansible configures the FCOS guest after its base image has booted and SSH is reachable. Butane/Ignition owns first-boot configuration; Ansible handles package layering/reboot coordination, security service activation, Suricata updates, active validation and health checks.

## Playbooks

| Playbook | Purpose |
|---|---|
| deploy-fcos-vm.yml | Provision FCOS on an existing libvirt hypervisor; verifies local persistent storage and refuses existing VM domains or orphaned disks |
| layer-fcos-packages.yml | Layer Firewalld, nftables, Suricata, AIDE, ClamAV, Lynis, podman-compose and logrotate with rpm-ostree; reboot only when a deployment is staged |
| configure-security.yml | Validate FCOS identity/NIC, Firewalld, SSH, Suricata NFQUEUE/rules, rootless Podman API and daily timers |
| suricata-ips-validation.yml | Add temporary IDS/IPS signatures, generate controlled HTTP traffic, verify EVE alerts/drop, restore production rules |
| podman-compose-poc.yml | Verify a preapproved local image, start an HTTP Compose stack through rootless Podman, test it and remove it |
| initialize-aide.yml | Explicitly initialize a missing AIDE baseline; refuses to overwrite an existing database and leaves the timer disabled |
| enable-aide-check.yml | Enable daily AIDE checks only after an explicit approval reason and successful baseline check |
| kasm-compatibility-poc.yml | Check Docker Engine and Docker Compose v2 requirements; fail closed before any Kasm installer if the endpoint is Podman |
| health-check.yml | Check hypervisor/KVM/VM state, FCOS services/timers, firewall, Suricata, AIDE timer state and rootless Podman |

The Host VM workflow is independent of Deploy Host OS. It requires an existing hypervisor with KVM/QEMU/libvirt, a bridge and a persistent local filesystem. For diskless Alpine, the storage path must be on the mounted NVMe volume; the playbook rejects tmpfs/overlay storage. The workflow stores the FCOS base/overlay QCOW2, Ignition and libvirt domain XML under that persistent path. Alpine's optional libvirt-vms OpenRC service restores the XML and starts the VM on reboot.

## Butane package contract

Butane writes configuration, policy, scripts and systemd units; it does not install RPMs. The package-layering playbook installs:

- firewalld, nftables
- suricata (provides suricata-update)
- aide
- clamav, clamav-freshclam
- lynis
- podman-compose
- logrotate

Podman and the user-level podman.socket are expected from the FCOS base image. Do not assume Toolbox packages exist inside FCOS.

## Butane-managed first boot

The current Butane profile configures:

- Core user's SSH public key; password and keyboard-interactive SSH disabled, forwarding/tunneling disabled.
- NetworkManager static IPv4 identity on the configured guest NIC (default enp1s0), gateway/DNS default 192.168.1.1.
- Firewalld public zone with inbound target DROP; SSH is the only inbound exception and is restricted to 192.168.1.0/24.
- HOST -> ANY egress policy bound to the explicit FCOS source IP; HTTP/HTTPS, DNS and NTP are allowed. TCP 80/443 are explicit.
- Suricata HOME_NET, EXTERNAL_NET, suricata.rules/local.rules, NFQ mode and EVE logging.
- nftables NFQUEUE input/output hooks on the configured NIC at priority -150, queue 0 with bypass.
- Suricata prepare/update/test service ordering, weekly ET Open refresh and rollback on failed rules/config validation.
- One daily ClamAV scan at 02:00; the scan service runs the freshclam one-shot dependency first. No automatic deletion/quarantine.
- Daily Lynis audit at 03:00.
- Daily AIDE check at 04:00, with timer disabled until the baseline is initialized and reviewed.
- Log rotation for ClamAV, Lynis and AIDE logs.
- Rootless Podman user socket, linger, CONTAINER_HOST, DOCKER_HOST and interactive docker/docker-compose aliases.
- Rootful system Podman/Docker socket activation masked.

The static guest address must match the DHCP reservation and egress policy. Defaults are FCOS 192.168.1.20/24, gateway/DNS 192.168.1.1, LAN 192.168.1.0/24, NIC enp1s0. Change the Butane workflow inputs and Ansible inventory together.

## Firewalld behavior

- Inbound defaults to DROP.
- SSH from 192.168.1.0/24 is the only inbound exception. Remove that rich rule if absolutely no inbound service is required, but retain console recovery.
- Host-originated IPv4 egress is source-bound to the FCOS LAN IP and permits HTTP, HTTPS, DNS and NTP.
- Other host-originated IPv4 egress is dropped. Add required ports explicitly and narrowly.
- This is not a complete container/forwarding egress policy. Validate rootless container traffic separately.
- Kasm HTTPS ingress is not opened by default. Only add a source-restricted 443 ingress rule after the Kasm compatibility gate passes.

## Suricata NFQUEUE behavior

- Interface: enp1s0 by default.
- HOME_NET: 192.168.1.0/24 by default.
- NFQUEUE number: 0.
- Rule source: Emerging Threats Open (et/open).
- Boot sequence: package preflight, update sources, enable ET Open, update rules, run suricata -T with the FCOS override, then start Suricata.
- Weekly rule refresh validates configuration before restarting Suricata. A failed update restores the previous rules directory.
- nftables queue bypass preserves connectivity if Suricata stops. This is fail-open; inspection is absent while the service is down, so monitor service health.
- Chains inspect traffic to/from the FCOS host. They do not inspect arbitrary traffic between other LAN clients; transit IPS needs routing/bridging or mirrored traffic and a separate FORWARD queue design.

The active validation playbook requires a controlled HTTP server on TCP/80 inside 192.168.1.0/24. It adds temporary IDS/IPS rules, verifies EVE alert/drop events and restores the generated rule file even when a test fails.

## Rootless Podman and Docker compatibility

Butane enables the user-level podman.socket for core, enables linger, exports CONTAINER_HOST and DOCKER_HOST as unix:///run/user/1000/podman/podman.sock, adds interactive docker/docker-compose aliases, and masks rootful system-level Podman/Docker sockets.

The API socket remains a Unix socket under the core user's runtime directory. Do not expose it over TCP. Aliases are interactive conveniences; automation uses explicit socket URLs.

### Registry approval and Compose smoke test

The Compose POC does not change registry trust policy and does not pull images. It requires the exact image to already exist in FCOS rootless storage. Before running Provision Services/Containers, use the existing podwhitelist function in the FCOS user's shell to approve and pull the selected image, then pass the exact image reference as container_smoke_image. The playbook checks that image exists and refuses to pull an unapproved image.

The repository does not reimplement the local podwhitelist function because its body and argument interface are not part of the repository. The CI workflow therefore consumes the image after it has been approved and pulled in the FCOS rootless store.

## AIDE baseline lifecycle

1. Run initialize-aide.yml with aide_initialize_baseline=true after FCOS provisioning is complete and trusted.
2. Review the initial database and check output.
3. Run enable-aide-check.yml with aide_baseline_approved=true and a non-empty aide_baseline_approval_reason.
4. The daily timer then runs at 04:00.
5. Never automatically reinitialize the baseline after an unexpected change.

## Kasm compatibility gate

The Kasm POC targets an isolated FCOS test VM, not the production guest. It checks Docker CLI/server identity, Docker Engine version, Docker Compose v2 availability/version and rootless engine identity. If the endpoint identifies as Podman or lacks the required Compose v2 plugin, the playbook fails closed and does not run the Kasm installer. A successful rootless Compose HTTP smoke test is not proof of Kasm compatibility.

## Commands

Run from diskless-os/ansible:

    ansible-playbook -i inventory/hosts.yml playbooks/deploy-fcos-vm.yml --syntax-check
    ansible-playbook -i inventory/hosts.yml playbooks/layer-fcos-packages.yml --syntax-check
    ansible-playbook -i inventory/hosts.yml playbooks/configure-security.yml --syntax-check
    ansible-playbook -i inventory/hosts.yml playbooks/suricata-ips-validation.yml --syntax-check
    ansible-playbook -i inventory/hosts.yml playbooks/podman-compose-poc.yml --syntax-check
    ansible-playbook -i inventory/hosts.yml playbooks/initialize-aide.yml --syntax-check
    ansible-playbook -i inventory/hosts.yml playbooks/enable-aide-check.yml --syntax-check
    ansible-playbook -i inventory/health.yml playbooks/health-check.yml --syntax-check

The GitHub Actions Provision Services/Containers workflow orchestrates package layering, security configuration, Compose HTTP validation and active Suricata IDS/IPS validation. Kasm Compatibility POC is a separate manual workflow requiring an isolated FCOS test VM.
