# Alpine Diskless Host

The physical host boots a PXE-served kernel/initramfs/rootfs. Keep root reproducible and persist necessary state with Alpine LBU.

1. PXE boot pinned/tested image.
2. Configure management network, DNS, NTP and SSH keys.
3. Install KVM/QEMU/libvirt for the pinned Alpine release.
4. Configure virtualization modules, bridges and durable VM storage.
5. Configure OpenRC services; persist required changes using `lbu commit`.
6. Validate `lbu status` and cold PXE boot.

Pin the Alpine release and package set in the image build after testing; this source does not assume release-specific package names.
