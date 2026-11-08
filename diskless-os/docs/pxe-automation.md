# PXE Deployment Automation

PXE automation has two planes:

1. **Boot plane:** firmware obtains a network boot program, iPXE menu, Alpine kernel, initramfs, modloop and apkovl.
2. **Configuration plane:** the generated apkovl configures the Alpine diskless host; the independent Host VM workflow provisions FCOS on an already-prepared hypervisor.

GitHub Actions coordinates build and publishing. It does not replace DHCP, TFTP/HTTP, iPXE, firmware PXE support or power control.

## Boot sequence

1. Firmware performs DHCP/PXE discovery.
2. DHCP/proxy-DHCP returns the boot server and initial boot filename.
3. Firmware retrieves an architecture/firmware-appropriate bootloader (often using TFTP).
4. iPXE downloads its menu and Alpine kernel/initramfs/modloop/apkovl over HTTP.
5. Alpine initramfs obtains the configured APK repositories, loads the apkovl and boots the diskless root filesystem.
6. OpenRC initializes the selected physical NIC, bridge br0, KVM modules, SSH and libvirtd.
7. If a persistent storage UUID was configured, localmount mounts the ext4 NVMe partition and libvirt-vms restores persistent libvirt XML after libvirtd starts.
8. The independent Deploy Host VM workflow provisions FCOS on the existing hypervisor. It does not require or invoke Deploy Host OS.
9. Health Check validates hypervisor and FCOS services.

PXE must be enabled and placed in firmware boot order. This is initially manual unless hardware exposes a supported remote-management API. CI cannot power on a machine without WOL/IPMI/Redfish/managed PDU.

## PXE service placement

Do not make Alpine the only PXE server if Alpine itself depends on PXE. Use an independent always-on host, router DHCP boot options plus separate TFTP/HTTP, or a NAS/server that demonstrably provides these services. If the NAS exposes SMB only, use it for storage and run PXE services elsewhere.

The publisher workflow uses an SSH-accessible PXE host and a protected path such as /srv/tftp. The HTTP server must expose the same document root at PXE_HTTP_BASE_URL.

## Host bridge and persistent storage

Alpine configures the selected physical NIC (default enp1s0) as a bridge port and assigns DHCP to br0. FCOS attaches to br0 and uses its reserved static LAN address.

For diskless Alpine, the Host OS workflow optionally accepts a UUID for an existing ext4 partition. It writes an fstab entry and enables an OpenRC service that restores persistent libvirt XML after the local storage mount. It does not partition, format, encrypt or resize the disk. If no storage UUID is supplied, Alpine boots without VM storage persistence and Deploy Host VM refuses to store VM data on the diskless rootfs.

FCOS base/overlay QCOW2, Ignition and libvirt domain XML are stored under the selected local persistent path. NAS/SMB is intended for PXE assets and backups; live VM disks should use local NVMe.

## dnsmasq example

Template for a PXE node at 192.168.1.2 while the router remains the only address-assigning DHCP server. Verify proxy-DHCP support, firmware architecture codes and boot filenames before deployment.

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

Do not enable a second independent DHCP server. If router DHCP already supports boot options, configure those and omit proxy-DHCP.

## iPXE menu

The repository menu is rendered with PXE_HTTP_BASE_URL by Deploy Host OS. It loads the published Alpine kernel/initramfs/modloop and host.apkovl.tar.gz from the current release. The default PXE HTTP server is 192.168.1.2.

## CI/CD workflows

### Validate
Validate Butane with strict mode, parse embedded Firewalld XML, syntax-check embedded shell scripts, lint Ansible playbooks and parse repository/workflow YAML.

### Deploy Host OS
1. Download pinned Alpine 3.24.4 x86_64 netboot archive.
2. Verify its published SHA-256.
3. Build deterministic apkovl with the protected Alpine SSH public key, host NIC and optional persistent ext4 mount UUID.
4. Render iPXE menu.
5. Upload a versioned release directory.
6. Verify remote checksums, atomically promote current symlink and verify HTTP retrieval.
7. Retain previous releases for rollback.

### Deploy Host VM
The VM workflow is independent of Host OS. It accepts an existing Alpine, Fedora Secureblue, Arch Linux or Ubuntu hypervisor, validates KVM/libvirt/bridge and local persistent storage, verifies a pinned FCOS QCOW2 SHA-256, renders Butane/Ignition and provisions the guest. It refuses to overwrite an existing VM or orphaned disk.

### Provision Services/Containers
Layer FCOS packages with rpm-ostree if requested, reboot only when needed, configure Firewalld/Suricata/AIDE/ClamAV/Lynis/rootless Podman, run active IDS/IPS validation and verify a preapproved rootless Compose HTTP smoke image.

### Health Check
Run Ansible health checks for the hypervisor and FCOS guest.

### Kasm Compatibility POC
Run separately on an isolated FCOS test VM. Verify Docker Engine identity and Docker Compose v2 version before considering the Kasm installer. The POC fails closed if the endpoint is Podman or lacks the required Compose plugin.

## Automation boundaries

| Task | Automation |
|---|---|
| Download/verify Alpine netboot assets | GitHub Actions |
| Build Alpine apkovl and iPXE menu | GitHub Actions |
| Publish versioned PXE release | GitHub Actions over authenticated SSH |
| Router DHCP/PXE options | Manual initially or supported router API |
| Firmware PXE/boot order | Manual initially unless remote management exists |
| Power/reboot | WOL/IPMI/Redfish/PDU if available |
| Alpine diskless host configuration | Versioned apkovl built and published by CI |
| FCOS VM provisioning | Ansible/libvirt workflow |
| FCOS services and containers | Butane/Ignition and Ansible |
| Health checks | Ansible/GitHub Actions |

## Security and recovery

Isolate PXE to a trusted LAN/VLAN; verify checksums; restrict write access to boot storage; protect CI secrets; retain previous releases and a fallback boot entry; preserve console recovery. The workflow verifies SHA-256 but does not currently verify the Alpine archive's detached GPG signature.
