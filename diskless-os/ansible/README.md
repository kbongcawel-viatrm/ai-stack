# Ansible Operations

The FCOS Ansible playbooks configure Suricata, Firewalld, SSH, AIDE, ClamAV and Lynis. Configuration-only: FCOS image must already contain required packages and units.

## SSH policy
Firewalld SSH source is `192.168.1.0/24`; sshd requires public-key auth, disables password/keyboard-interactive, and allows root by key only. Root authorized_keys must be provisioned first. Keep console access and run the deploy runner from the allowed LAN.

## Daily jobs
ClamAV daily at 02:00 logs to `/var/log/clamav`; Lynis daily at 03:00 to `/var/log/lynis`; AIDE daily at 04:00 to `/var/log/aide`, with timer disabled until a trusted baseline is reviewed.

## Commands
```bash
ansible-playbook -i inventory/hosts.yml playbooks/configure-security.yml --syntax-check
ansible-lint playbooks/configure-security.yml
ansible-playbook -i inventory/hosts.yml playbooks/configure-security.yml --check --diff
ansible-playbook -i inventory/hosts.yml playbooks/configure-security.yml --diff
ansible-playbook -i inventory/health.yml playbooks/health-check.yml
```
