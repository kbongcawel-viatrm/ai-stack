# PXE Deployment Automation

PXE automation has two planes:

1. **Boot plane:** firmware obtains a network boot program, iPXE menu, Alpine kernel, initramfs and root filesystem.
2. **Configuration plane:** after Alpine is reachable, Ansible configures the host and its guest VMs.

GitHub Actions coordinates the process; it does not replace DHCP, TFTP/HTTP, iPXE, firmware PXE support or power control.

## Boot sequence

1. Firmware performs DHCP/PXE discovery.
2. DHCP/proxy-DHCP returns the boot server and initial boot filename.
3. Firmware retrieves an architecture/firmware-appropriate bootloader (often using TFTP).
4. iPXE downloads its script/menu and Alpine kernel/initramfs/rootfs (HTTP is preferable for larger assets).
5. Alpine boots its diskless root filesystem.
6. Networking and OpenRC services initialize.
7. The self-hosted runner/controller verifies SSH availability.
8. Ansible configures Alpine and provisions/updates FCOS and Ubuntu VMs.
9. Health checks validate host/guest services, timers, containers and HTTPS endpoints.

PXE must be enabled and placed in firmware boot order. This is initially manual unless hardware exposes a supported remote-management API. CI cannot power on a machine without WOL/IPMI/Redfish/managed PDU.

## PXE service placement

Do not make Alpine the only PXE server if Alpine itself depends on PXE. Use an independent always-on host, router DHCP boot options plus separate TFTP/HTTP, or a NAS/server that demonstrably provides these services. If the Archer AX55 exposes SMB only, use it for storage and run PXE services elsewhere.

## dnsmasq example

Template for a PXE node at 192.168.1.2 while the router remains the only address-assigning DHCP server. Verify proxy-DHCP support, firmware architecture codes and boot filenames before deployment.

```ini
port=0
interface=br0
bind-interfaces
log-dhcp
dhcp-range=192.168.1.0,proxy
enable-tftp
tftp-root=/srv/tftp
dhcp-no-override
dhcp-match=set:bios,option:client-arch,0
dhcp-boot=tag:bios,undionly.kpxe
dhcp-match=set:efi64,option:client-arch,7
dhcp-boot=tag:efi64,ipxe.efi
dhcp-userclass=set:ipxe,iPXE
dhcp-boot=tag:ipxe,http://192.168.1.2/boot/menu.ipxe
```

Do not enable a second independent DHCP server. If router DHCP already supports boot options, configure those and omit proxy-DHCP.

## iPXE menu example

```ipxe
#!ipxe
dhcp
set base http://192.168.1.2/boot/alpine/current
menu Diskless Home Server
item alpine Alpine Linux diskless host
item shell iPXE shell
choose --default alpine --timeout 5000 target || exit
goto ${target}
:alpine
kernel ${base}/vmlinuz-lts
initrd ${base}/initramfs-lts
# Kernel/initramfs arguments depend on the actual Alpine diskless image.
boot
:shell
shell
```

The Alpine initramfs/rootfs arguments depend on how that image is built; there is no universal root= argument to assume.

## CI/CD stages

### Validate
Check iPXE script, boot manifest/checksums, Butane strict conversion, Ansible syntax/lint/check mode and shell/YAML.

### Build
Build/assemble a pinned Alpine diskless image, generate Ignition from Butane, and produce a SHA-256 manifest. Never embed credentials in boot artifacts.

### Stage and publish
Copy files to a versioned release directory such as `/srv/tftp/boot/alpine/releases/<git-sha>/`; verify checksums after transfer; test TFTP/HTTP retrieval; promote the boot manifest/menu only after success; retain the previous release.

### Deploy
Run a protected workflow on the `home-server` runner; publish with a restricted identity; reboot only in an approved maintenance window; wait for Alpine SSH; run Ansible and health checks.

### Rollback
Point iPXE to the prior release, reboot via console or supported management, and preserve failed artifacts/logs for diagnosis.

## Automation boundaries

| Task | Automation |
|---|---|
| Build/validate Alpine artifacts | CI |
| Transfer and verify artifacts | CI with authenticated storage |
| Promote versioned boot release | CI |
| Router DHCP options | Manual initially or supported router API |
| Firmware PXE/boot order | Manual initially unless remote management exists |
| Power/reboot | WOL/IPMI/Redfish/PDU if available |
| OS and service configuration | Ignition, Ansible, cloud-init |
| Health checks | Ansible/GitHub Actions |

## Security

Isolate PXE to trusted LAN/VLAN; verify checksums/signatures; restrict write access to boot storage; protect CI secrets; retain a fallback boot entry and console recovery.
