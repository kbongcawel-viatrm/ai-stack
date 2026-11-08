# Alpine Diskless Host (Default)

The default physical host is Alpine Linux booted by iPXE. The Host OS workflow downloads a pinned Alpine netboot release, verifies its SHA-256, builds a deterministic apkovl, publishes versioned kernel/initramfs/modloop/apkovl artifacts, and atomically promotes the `current` release.

## Included apkovl configuration

The repository apkovl provides:

- Alpine v3.24 main/community repositories.
- A pinned package set for OpenSSH, Python, QEMU x86_64, libvirt, virt-install, nftables and base host utilities.
- Root public-key-only SSH access.
- DHCP management networking on the selected physical NIC (default `enp1s0`).
- OpenRC startup for networking, kernel modules, SSH and libvirtd.
- Intel KVM module loading (`kvm`, `kvm_intel`).

The public key is injected at build time from `ALPINE_SSH_PUBLIC_KEY`; no private key is included in the apkovl. The Host OS workflow also requires the PXE publisher secrets and `PXE_HTTP_BASE_URL` repository variable.

## Deploy

Run the root-level **Deploy Host OS - Alpine diskless PXE** workflow manually. Set `publish=true` only after configuring the protected `pxe-production` environment and its SSH credentials.

The workflow retains previous releases and promotes the new one through an atomic symlink update. It does not change router DHCP, firmware boot order, or reboot the physical host.

## Persistence model

The generated apkovl is a version-controlled, read-only HTTP boot artifact. Runtime edits made on the diskless host are not automatically written back to the repository or PXE server. To persist runtime changes, configure and test an Alpine LBU target on writable local/NAS storage separately; this repository does not yet mount or write LBU backups to SMB.

Treat the apkovl as the source of truth for reproducible boot configuration. Change the repository files and republish rather than relying on uncommitted changes in RAM.

## Host VM deployment independence

The **Deploy Host VM** workflow does not require this PXE workflow. It can target an already-installed Alpine, Fedora Secureblue, Arch Linux or Ubuntu hypervisor, provided KVM/QEMU/libvirt, the requested bridge and durable image storage are already prepared.

See [PXE automation](../docs/pxe-automation.md) and [deployment plan](../docs/deployment-plan.md).
