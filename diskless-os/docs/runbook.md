# Operations Runbook

## Deploy workflow boundaries

- **Deploy Host OS:** publishes the Alpine netboot assets and generated apkovl. It does not configure router DHCP, change firmware boot order or reboot the physical host.
- **Deploy Host VM:** targets an already-prepared hypervisor. It does not invoke Deploy Host OS.
- **Provision Services/Containers:** layers packages if requested, configures FCOS, validates Suricata and tests rootless Compose.
- **Health Check:** runs Ansible validation; it does not repair a failed service.
- **Kasm Compatibility POC:** targets an isolated FCOS test VM and never installs Kasm automatically.

## PXE
```bash
curl -fsS http://192.168.1.2/boot/alpine/current/manifest.sha256
curl -fsS http://192.168.1.2/boot/menu.ipxe
readlink -f /srv/tftp/boot/alpine/current
```

Verify the active symlink points to the expected release and that TFTP/HTTP serves the exact files. Keep prior releases for rollback.

## Hypervisor
```bash
virsh -c qemu:///system list --all
virsh -c qemu:///system dominfo fcos-security
virsh -c qemu:///system domifaddr fcos-security
qemu-img info /var/lib/libvirt/images/fcos-security.qcow2
ip -br link
```

The VM deployment playbook requires KVM, libvirt, a pre-existing bridge and durable image storage. It refuses to overwrite an existing domain or orphaned disk.

## FCOS
```bash
cat /etc/os-release
ip -br addr
# or: ip route get 192.168.1.1   # shows the interface carrying the default route
systemctl is-system-running
systemctl --failed
systemctl status firewalld suricata-nfq-rules.service suricata.service
systemctl --user status podman.socket
loginctl show-user core -p Linger
systemctl list-units 'ssh-provision.service' 'firewalld-provision.service' 'suricata-prepare.service' 'clamav-provision.service' 'lynis-provision.service' 'aide-provision.service' --all
journalctl -u '*provision*' -u suricata-prepare --since today
systemctl list-timers --all | grep -E 'aide|clamav|lynis|suricata'
firewall-cmd --get-active-zones
firewall-cmd --info-policy fcos-host-egress
```

## Suricata
```bash
suricata --build-info | grep -Ei 'NFQ|NFQUEUE'
suricata -T -c /etc/suricata/suricata.yaml --include /etc/suricata/fcos-overrides.yaml
suricata-update list-enabled-sources
nft list table inet suricata_nfq
journalctl -u suricata -u suricata-nfq-rules --since today
tail -f /var/log/suricata/eve.json
```

A running service is not sufficient proof of IPS. Run `playbooks/suricata-ips-validation.yml` with a controlled LAN HTTP server on TCP/80. The playbook temporarily installs alert/drop signatures, checks EVE events and restores the production rule file.

## Daily scan logs
```bash
find /var/log/aide /var/log/clamav /var/log/lynis -maxdepth 2 -type f
systemctl status aide-check.timer clamav-freshclam-daily.timer clamav-scan.timer lynis-audit.timer
journalctl -u aide-check.service -u clamav-freshclam-daily.service -u clamav-scan.service -u lynis-audit.service --since today
```

AIDE timer remains disabled until the trusted baseline has been initialized and reviewed. Confirm the database path from `/etc/aide.conf` before initializing or replacing the baseline.

## Rootless Podman and Compose
```bash
printf '%s\n' "$CONTAINER_HOST"
printf '%s\n' "$DOCKER_HOST"
systemctl --user status podman.socket
podman --remote --url "$CONTAINER_HOST" info
docker version
docker compose version
docker-compose version
podman-compose ps
```

Run these commands inside the actual FCOS VM as `core`, not in a Toolbox sharing the Secureblue host socket. Verify the returned distribution/hostname and `rootless: true`.

Before the Compose smoke workflow, use the existing `podwhitelist` function inside the FCOS user's shell to approve and pull the exact image reference. The workflow checks that the image is already present and does not change registry policy or pull it.

## Recovery

Use hypervisor/VM console access if firewall or SSH changes lock out remote access. Preserve journal and Suricata logs before retrying. Restore the previous known-good PXE release or FCOS overlay/base image as appropriate. Do not delete VM disks or AIDE databases as a troubleshooting shortcut.

### Kasm Workspaces (optional profile)

Kasm is excluded from default builds. Deploy with `enable_kasm=true` on
`deploy-host-vm` (sets `FCOS_EXCLUDE_SERVICES=docker-lockdown`), which adds
`moby-engine`/`docker-compose` to the rpm-ostree layer and unmasks Docker.
First boot then runs `kasm-install.service` (pinned 1.19.0 bundle,
sha256-verified, `install.sh --accept-eula --no-swap-check`, up to 2h).

```bash
systemctl status kasm-install.service
journalctl -u kasm-install.service --no-pager | tail -50
grep -A5 'admin@kasm.local' /opt/kasm/current/install_log.txt
```

Post-install API/UI trimming is driven by
`diskless-os/ansible/playbooks/configure-kasm.yml`.
