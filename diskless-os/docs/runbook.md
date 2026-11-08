# Operations Runbook

## Deploy workflow boundaries

- **Deploy Host OS:** publishes Alpine netboot files and iPXE menu. It does not configure router DHCP or force a reboot.
- **Deploy Host VM:** targets an already-installed hypervisor. It does not invoke Deploy Host OS.
- **Provision Services/Containers:** targets the FCOS VM.
- **Health Check:** runs Ansible validation; it does not repair a failed service.

## PXE
```bash
curl -fsS http://192.168.1.2/boot/alpine/current/manifest.sha256
curl -fsS http://192.168.1.2/boot/menu.ipxe
``
Verify the active symlink points to the expected release and that TFTP/HTTP serves the exact files.

## Hypervisor
```bash
virsh list --all
virsh dominfo fcos-security
virsh domifaddr fcos-security
qemu-img info /var/lib/libvirt/images/fcos-security.qcow2
``
The VM deployment playbook refuses to overwrite an existing domain or disk by default.

## FCOS
```bash
cat /etc/os-release
systemctl is-system-running
systemctl --failed
systemctl status firewalld suricata suricata-nfq.service
systemctl --user status podman.socket
loginctl show-user core -p Linger
systemctl list-timers --all | grep -E 'aide|clamav|lynis'
firewall-cmd --get-active-zones
firewall-cmd --policy fcos-host-egress --list-all
``

## Suricata
```bash
ip -br addr show enp1s0
suricata -T -c /etc/suricata/suricata.yaml
suricata-update list-enabled-sources
nft list table inet suricata_nfq
journalctl -u suricata -u suricata-nfq --since today
tail -f /var/log/suricata/eve.json
``
A running service is not sufficient proof of IPS. Re-run the controlled IDS/IPS validation playbook with a reachable second LAN endpoint.

## Daily scan logs
```bash
find /var/log/aide /var/log/clamav /var/log/lynis -maxdepth 2 -type f
systemctl status aide-check.timer clamav-scan.timer lynis-audit.timer
journalctl -u aide-check.service -u clamav-scan.service -u lynis-audit.service --since today
``
AIDE timer remains disabled until the trusted baseline has been initialized, reviewed and protected.

## Rootless Podman
```bash
printf '%s\n' "$CONTAINER_HOST"
podman --remote --url "$CONTAINER_HOST" info
docker version
docker compose version
podman-compose ps
``
Confirm `docker info` identifies the FCOS VM and `rootless: true`; do not confuse a Toolbox using the host socket with the actual FCOS VM.

## Recovery
Use console access if firewall/SSH changes lock out remote access. Preserve journal and Suricata logs before retrying. Roll back the VM overlay/image or restore the previous known-good PXE release; do not delete disks or AIDE databases as a troubleshooting shortcut.
