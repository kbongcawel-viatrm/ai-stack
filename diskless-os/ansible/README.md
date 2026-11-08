# Ansible Operations

Ansible runs after the FCOS VM is reachable over SSH. Butane/Ignition owns first-boot configuration files and systemd units. Ansible owns FCOS package layering/reboot coordination, rootless Podman socket activation, Suricata rule-source initialization, IPS service activation, traffic validation and health checks.

## Playbooks

| Playbook | Target | Purpose |
|---|---|---|
| deploy-host-vm.yml | hypervisors | Create FCOS VM on an already prepared Alpine, Secureblue, Arch or Ubuntu hypervisor |
| provision-services.yml | fcos | Layer missing RPMs, reboot, configure rootless Podman, Firewalld, Suricata and daily timers |
| validate-suricata.yml | fcos | Prove IDS alerting and IPS packet drop against a second LAN HTTP endpoint |
| health-check.yml | hypervisors + fcos | Verify hypervisor, services, timers, firewall, SSH and rootless Podman |

Deploy Host VM is independent of Deploy Host OS. It does not install or reimage the hypervisor. KVM/QEMU/libvirt, the bridge and VM storage must already be prepared.

## Butane package contract

The FCOS Butane config writes:
- SSH public-key-only policy.
- Firewalld public zone and HOST-to-ANY egress policy.
- Suricata YAML, NFQUEUE nftables rules, rule-update script and custom systemd unit.
- ClamAV scan/update, Lynis audit and AIDE check scripts/services/timers.
- Rootless Podman Docker API shell aliases and wrapper commands.
- A rootless Podman bootstrap script/service.

Butane does not install RPMs. The provisioning playbook layers the Fedora packages and reboots into the new deployment before activating services. The package list is firewalld, nftables, suricata, aide, clamav, clamav-freshclam, lynis and podman-compose. Podman itself is expected from the FCOS base image.

## Required network defaults

The checked-in profile assumes:
- FCOS interface: enp1s0
- FCOS IPv4 address: 192.168.1.20 (must be static or DHCP-reserved)
- Trusted LAN: 192.168.1.0/24
- FCOS SSH user: core

Change the Butane configuration and inventory together if these values differ. Firewalld inbound target is DROP; SSH is the only inbound exception from the LAN. Host egress is source-bound to 192.168.1.20 and allows HTTP, HTTPS, DNS and NTP. This is a host egress policy, not a complete container-forwarding policy.

## Rootless Podman and Docker compatibility

The rootless bootstrap script enables linger for core, creates the user-level podman.socket link and starts the user socket. The system socket must remain at /run/user/<UID>/podman/podman.sock. The interactive profile exports CONTAINER_HOST and defines:
- docker -> podman --remote --url "$CONTAINER_HOST"
- docker-compose -> podman-compose

Executable wrappers are installed for automation. Do not enable the rootful Podman socket or expose the API over TCP. A successful Docker CLI connection is not proof of Kasm compatibility.

## Suricata

The service profile pins:
- NIC: enp1s0
- HOME_NET: 192.168.1.0/24
- NFQUEUE queue: 0
- Rules: Emerging Threats Open (et/open)
- Update sequence: suricata-update update-sources, enable-source et/open, update, then suricata -T -c /etc/suricata/suricata.yaml.
- Engine: custom suricata-nfq.service, enabled only after the initial rule update and config test pass.

The nftables hooks inspect FCOS host INPUT/OUTPUT traffic, not arbitrary transit traffic. Queue bypass is fail-open to preserve management connectivity if Suricata stops. IPS inspection is absent during that failure state.

The validate-suricata playbook requires a reachable second LAN host serving HTTP. Set suricata_test_target and suricata_test_port. It installs temporary local signatures, confirms an IDS alert in EVE, confirms an IPS drop, and restores the original rules in an always block. Do not claim IDS/IPS validation from service status alone.

## Daily jobs

| Timer | Schedule | Purpose |
|---|---:|---|
| clamav-update.timer | 01:40 | Refresh ClamAV signatures |
| clamav-scan.timer | 02:00 | Read-only scan of /var/home/core |
| lynis-audit.timer | 03:00 | Daily Lynis audit |
| aide-check.timer | 04:00 | Daily AIDE integrity check; disabled until baseline review |
| suricata-update.timer | 01:30 | Daily ET Open rules update after initial validation |

ClamAV never auto-deletes or quarantines files. The initial scan scope is the FCOS core user's home directory; expand it deliberately after measuring resource usage.

AIDE timer stays disabled until its baseline is initialized and reviewed. Never automatically regenerate the baseline after an unexpected change. The AIDE baseline location must be confirmed against /etc/aide.conf before initialization.

## Commands

Run from diskless-os/ansible:

```bash
ansible-playbook -i inventory/hosts.yml playbooks/deploy-host-vm.yml --syntax-check
ansible-playbook -i inventory/hosts.yml playbooks/provision-services.yml --syntax-check
ansible-playbook -i inventory/hosts.yml playbooks/validate-suricata.yml --syntax-check
ansible-playbook -i inventory/hosts.yml playbooks/health-check.yml --syntax-check

ansible-playbook -i inventory/hosts.yml playbooks/provision-services.yml --check --diff
ansible-playbook -i inventory/hosts.yml playbooks/provision-services.yml --diff
ansible-playbook -i inventory/hosts.yml playbooks/validate-suricata.yml \
  --extra-vars "suricata_test_target=192.168.1.100 suricata_test_port=80"
ansible-playbook -i inventory/health.yml playbooks/health-check.yml
```

The 192.168.1.100 endpoint above is an example only; use a real reachable LAN HTTP test host.
