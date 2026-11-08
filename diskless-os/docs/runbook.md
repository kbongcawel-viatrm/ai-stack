# Operations Runbook

## PXE
```bash
ip route
curl -fsS http://192.168.1.2/boot/alpine/current/manifest.txt
```
Inspect DHCP logs and confirm server/boot filename. Test TFTP retrieval of the exact boot filename.

## Alpine
```bash
cat /etc/alpine-release
rc-status
ip -br addr
ip route
lbu status
virsh list --all
```

## FCOS
```bash
cat /etc/os-release
systemctl is-system-running
systemctl --failed
systemctl status firewalld suricata clamav-freshclam
systemctl list-timers --all | grep -E 'aide|clamav|lynis'
firewall-cmd --get-active-zones
firewall-cmd --list-all
sshd -t
sshd -T -C user=root,host=localhost,addr=192.168.1.10
```
SSH must permit public keys only from 192.168.1.0/24, with root key login. Keep sshd and Firewalld aligned.

## Scan logs
```bash
find /var/log/aide /var/log/clamav /var/log/lynis -maxdepth 2 -type f
systemctl status aide-check.timer clamav-scan.timer lynis-audit.timer
journalctl -u aide-check.service -u clamav-scan.service -u lynis-audit.service --since today
```
Never automatically regenerate the AIDE baseline after unexplained changes.

## Ubuntu/Kasm
```bash
sudo systemctl is-active docker
sudo docker ps --format 'table {{.Names}}\t{{.Status}}'
curl -kI https://127.0.0.1/
```

## Recovery
Inspect DHCP/PXE logs; select previous iPXE release; use console for initramfs/rootfs errors; verify NAS mounts, libvirt storage/networks and VM state; preserve logs/artifacts before retry.
