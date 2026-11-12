# Alpine Diskless Host (Default)

The default physical host is Alpine Linux booted by iPXE. The Deploy Host OS workflow downloads a pinned Alpine netboot release, verifies its SHA-256, builds a deterministic apkovl, publishes versioned kernel/initramfs/modloop/apkovl artifacts, and atomically promotes the current release.

## Included apkovl configuration

The repository apkovl provides:

- Alpine v3.24 main/community repositories.
- A package set for OpenSSH, Python, QEMU x86_64, libvirt, virt-install, bridge utilities, nftables and base host utilities.
- Root public-key-only SSH access.
- A Linux bridge (default br0) with DHCP on the bridge; the selected physical NIC (default enp1s0) is enslaved to it.
- OpenRC startup for networking, kernel modules, SSH and libvirtd.
- Intel KVM module loading (kvm, kvm_intel).
- Optional persistent ext4 NVMe storage mounted by filesystem UUID (default mountpoint /mnt/nvme).
- When persistent storage is configured, an OpenRC service restores libvirt domain XML definitions from the persistent VM storage directory after the volume and libvirtd are ready.

The public key is injected at build time from ALPINE_SSH_PUBLIC_KEY; no private key is included in the apkovl.

## Deploy

Run the root-level **Deploy Host OS - Alpine diskless PXE** workflow manually. Set publish=true only after configuring the protected pxe-production environment and its SSH credentials.

Inputs:
- host_nic: physical NIC to bridge (default enp1s0)
- host_bridge: bridge interface (default br0)
- storage_uuid: UUID of a preformatted ext4 partition for persistent VM storage
- storage_mountpoint: mountpoint (default /mnt/nvme)
- vm_storage_path: VM image directory (default /mnt/nvme/libvirt/images)

To obtain the UUID after you have prepared the storage partition:

```bash
blkid -s UUID -o value /dev/nvme0n1pX
```

Replace the example device with the actual partition. **The workflow does not partition or format disks.** Back up the target disk and prepare an ext4 filesystem before supplying its UUID. Without storage_uuid, the persistent mount and libvirt domain-restoration service are omitted; Deploy Host VM will refuse to place VM disks on Alpine's diskless root filesystem.

The workflow retains previous releases and promotes the new one through an atomic symlink update. It does not change router DHCP, firmware boot order, or reboot the physical host.

## Persistence model

The generated apkovl is a version-controlled, read-only HTTP boot artifact. VM disks and domain XML can be stored on the optional persistent NVMe mount. Runtime changes made to the Alpine root filesystem are not automatically written back to the repository or PXE server. Writable Alpine LBU persistence is a separate setup and is not yet automated.

Treat the apkovl as the source of truth for reproducible boot configuration. Change repository files and republish rather than relying on uncommitted changes in RAM.

## Host VM deployment independence

The **Deploy Host VM** workflow does not require this PXE workflow. It can target an already-installed Alpine, Fedora Secureblue, Arch Linux or Ubuntu hypervisor, provided KVM/QEMU/libvirt, the requested bridge and durable image storage are already prepared.

See [PXE automation](../docs/pxe-automation.md) and [deployment plan](../docs/deployment-plan.md).
