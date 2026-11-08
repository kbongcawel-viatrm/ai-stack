# Alpine Diskless Host (Default)

Alpine Linux is the default physical hypervisor and boots through iPXE. The Deploy Host OS workflow downloads a pinned Alpine netboot archive, verifies its SHA-256, builds a deterministic apkovl, publishes versioned kernel/initramfs/modloop/apkovl artifacts and atomically promotes the current release.

## Included apkovl configuration

- Alpine v3.24 main/community repositories.
- OpenSSH, Python, QEMU x86_64, libvirt, virt-install, nftables, bridge executor and util-linux.
- Root public-key-only SSH access; the private key is never included.
- Physical NIC selected at build time (default enp1s0) attached to br0; DHCP runs on br0.
- OpenRC networking, localmount (when storage is configured), KVM modules, SSH, libvirtd and optional persistent-domain restore service.
- Intel KVM modules kvm and kvm_intel.

## Optional persistent local NVMe

The diskless root filesystem is volatile. The Host OS workflow therefore accepts an optional UUID for an existing, already formatted ext4 partition:

- storage_uuid: filesystem UUID (do not supply a disk device name).
- storage_mountpoint: default /mnt/nvme.
- vm_storage_path: default /mnt/nvme/libvirt/images.
- storage_fstype: ext4 only.

When a UUID is supplied, the apkovl writes an /etc/fstab entry, creates the mountpoint and enables libvirt-vms. On boot, libvirt-vms waits for localmount and libvirtd, checks that the storage mount is present, redefines persistent domain XML and starts the FCOS guest.

The workflow does not partition, format, encrypt or resize disks. Prepare the ext4 filesystem and obtain its UUID first. If no UUID is supplied, Alpine still boots, but the Deploy Host VM playbook will refuse to store VM data on the diskless root filesystem.

The FCOS QCOW2 base/overlay, Ignition file and libvirt domain XML are stored under vm_storage_path. Use local NVMe for live VM disks. NAS/SMB is appropriate for PXE artifacts and backups, not the default live qcow2 storage path.

## Deploy

Run Deploy Host OS - Alpine Diskless PXE. Set publish=true only after configuring the protected pxe-production environment and SSH credentials. The workflow does not alter router DHCP, firmware boot order or reboot the physical host.

The generated apkovl is a version-controlled, read-only HTTP artifact. Arbitrary runtime changes are not automatically committed to the repository or PXE server. LBU backup/persistence for changes outside the apkovl remains a separate operation.

## Host VM deployment independence

Deploy Host VM does not require this PXE workflow. It can target an already-installed Alpine, Fedora Secureblue, Arch Linux or Ubuntu hypervisor, provided KVM/QEMU/libvirt, the requested bridge and persistent local storage are ready. For a diskless Alpine target, use the NVMe UUID/mountpoint configured by Deploy Host OS.

See PXE automation and deployment plan.
