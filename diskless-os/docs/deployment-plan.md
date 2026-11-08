# Deployment Plan

## Phase 0 — Discovery and safety
- [ ] Record NIC names/MACs, BIOS/UEFI mode, Secure Boot and PXE/iPXE capability.
- [ ] Record router DHCP and boot-option support.
- [ ] Verify Archer AX55 SMB and any TFTP/HTTP capability.
- [ ] Reserve addresses for PXE, Alpine, FCOS and Ubuntu/Kasm.
- [ ] Assess RAM, CPU, storage IOPS and network. The previously discussed 8 GB host is constrained for Kasm plus security services; allocate carefully.
- [ ] Back up router/NAS settings and existing data.

**Gate:** keep local/console recovery until a test client completes PXE boot.

## Phase 1 — PXE
- [ ] Use router DHCP boot options or one dedicated DHCP service; never run competing DHCP servers.
- [ ] Serve firmware-appropriate iPXE, Alpine kernel/initramfs/rootfs over TFTP/HTTP.
- [ ] Configure MAC-based selection and versioned boot menu.
- [ ] Test complete boot and artifact checksums with a non-production client.

## Phase 2 — Alpine
- [ ] PXE boot Alpine.
- [ ] Configure management network, DNS, NTP and SSH keys.
- [ ] Install KVM/QEMU/libvirt for the pinned Alpine release.
- [ ] Configure virtualization modules, bridges, persistent VM storage and OpenRC.
- [ ] Persist required state with LBU; validate cold boot.

## Phase 3 — FCOS security VM
- [ ] Generate Ignition from `butane/fcos.bu` with pinned Butane.
- [ ] Provision persistent VM disk and NIC topology.
- [ ] Ensure FCOS image contains Suricata, Firewalld, AIDE, ClamAV and Lynis.
- [ ] Validate and apply Ansible.
- [ ] Verify Suricata packet visibility.
- [ ] Initialize/review AIDE baseline and back it up off-host before enabling timer.
- [ ] Verify ClamAV/Lynis daily timers and logs.

## Phase 4 — Ubuntu Kasm VM
- [ ] Provision supported Ubuntu Server VM.
- [ ] Install Docker Engine per current Kasm requirements.
- [ ] Install Kasm using its current official installer and compatibility matrix.
- [ ] Validate HTTPS, login, workspace launch and resource usage.
- Toolbox is for development tools, not the Kasm server runtime.

## Phase 5 — CI/CD
- [ ] Register runner labelled `home-server`.
- [ ] Use least-privilege repository access and protected environments.
- [ ] Store private keys and pre-verified known_hosts in GitHub secrets.
- [ ] Validate Butane, Ansible, shell, YAML and PXE manifests.
- [ ] Publish artifacts via stage → checksum verify → atomic promotion.
- [ ] Run Ansible and cross-host health checks.

## Phase 6 — Recovery
- [ ] Retain previous known-good Alpine boot artifact/menu.
- [ ] Back up VM definitions, disks and application data separately.
- [ ] Test PXE rollback and VM restore.
- [ ] Monitor hypervisor/VM state independently of SSH health checks.
