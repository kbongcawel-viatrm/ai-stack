# Deployment Plan

## Phase 0 — Prerequisites and recovery
- [ ] Record NIC names/MACs, BIOS/UEFI mode, Secure Boot and PXE/iPXE capability.
- [ ] Confirm router DHCP behavior; do not run competing DHCP servers.
- [ ] Confirm PXE HTTP/TFTP publisher path and storage permissions.
- [ ] Reserve host, FCOS and PXE addresses.
- [ ] Confirm hypervisor KVM/QEMU/libvirt, bridge and durable local storage before running Deploy Host VM.
- [ ] Back up existing VM/storage and keep console recovery.

## Phase 1 — Host OS (independent workflow)
- [ ] Run Deploy Host OS with pinned Alpine 3.24.4 x86_64.
- [ ] Verify downloaded netboot archive against Alpine's published SHA-256 file.
- [ ] Build the version-controlled apkovl with root public key, host NIC, bridge and hypervisor packages.
- [ ] If Alpine will host FCOS, prepare an ext4 NVMe partition and supply its UUID, mountpoint and VM storage path to the Host OS workflow. The workflow does not partition or format disks.
- [ ] Publish versioned kernel/initramfs/modloop/apkovl and promote the current symlink only after remote checksum verification.
- [ ] Configure router PXE boot options or proxy-DHCP/TFTP on a separate service.
- [ ] PXE boot and validate Alpine diskless startup, br0, SSH, OpenRC, KVM modules, libvirtd and the optional persistent storage mount.
- [ ] Runtime LBU backup/persistence outside the generated apkovl remains a separate setup.
- [ ] Alternatively, prepare a manually installed Secureblue, Arch or Ubuntu host.

## Phase 2 — Host VM (does not depend on Phase 1)
- [ ] Set the hypervisor target and host_os (alpine, secureblue, arch or ubuntu).
- [ ] Confirm virsh, qemu-img, KVM and the selected bridge already exist.
- [ ] Set vm_storage_path to a local persistent filesystem; the playbook accepts ext4, XFS, Btrfs or F2FS and rejects tmpfs/overlay/network filesystems. For Alpine diskless, keep this path identical to the Host OS apkovl workflow value.
- [ ] Supply a pinned, uncompressed FCOS QCOW2 URL and SHA-256 plus the FCOS SSH public key.
- [ ] Render/validate the composed Butane fragments (compose-bu.py → per-fragment `butane --strict` → merged Ignition) and provision the FCOS VM.
- [ ] Verify FCOS static IP, SSH and guest network reachability.
- [ ] Confirm base/overlay QCOW2, Ignition and libvirt domain XML are stored under the persistent path.
- [ ] On Alpine diskless, confirm libvirt-vms restores the domain after a reboot.

## Phase 3 — FCOS provisioning
- [ ] Confirm fcos-package-layer.service ran on first boot and FCOS rebooted into the rpm-ostree layered deployment.
- [ ] Confirm each service's first-boot provision oneshot passed: ssh-provision, firewalld-provision, suricata-prepare, clamav-provision, lynis-provision, aide-provision (`systemctl list-units '*provision*' '*prepare*'`).
- [ ] Run Provision Services/Containers for configuration management and validation; it performs no package installation.
- [ ] Configure rootless Podman user socket and linger.
- [ ] Configure CONTAINER_HOST, DOCKER_HOST and interactive docker/docker-compose aliases.
- [ ] Configure Firewalld inbound default DROP and explicit source-bound LAN egress policy.
- [ ] Configure Suricata NFQUEUE on the guest NIC (interface-name agnostic), HOME_NET 192.168.1.0/24 and free ET Open rules.
- [ ] Run suricata -T -c /etc/suricata/suricata.yaml, then validate the active FCOS override before service activation.
- [ ] Validate IDS alert and IPS drop using a controlled HTTP endpoint on a second LAN host.
- [ ] Enable daily ClamAV and Lynis systemd timers. Initialize AIDE baseline, review it, then explicitly enable its daily timer.
- [ ] Use the existing podwhitelist helper inside FCOS to approve/pull the exact Compose smoke image.
- [ ] Validate rootless Podman Compose start/HTTP/stop lifecycle.

## Phase 4 — Kasm POC gate
- [ ] Confirm Kasm's current Docker Engine and Docker Compose requirements.
- [ ] Run Kasm Compatibility POC on an isolated FCOS test VM, not the production guest.
- [ ] Verify Docker API identity and Docker Compose v2 version. Podman identity or missing Compose v2 fails the gate.
- [ ] Do not run the Kasm installer unless the Docker/Compose gate passes.
- [ ] If the gate passes, perform the installer, service, storage, networking and HTTPS tests on the isolated VM.
- [ ] Defer a default workspace lifecycle test until the host has sufficient memory. Kasm documents 4 GB/2 cores minimum for the host and its default workspace uses 2768 MB/2 cores; the current 8 GB physical host has insufficient headroom for Alpine, FCOS, Kasm and a default workspace.
- [ ] If any gate fails, stop and decide whether Kasm needs a separately supported runtime. Do not silently switch FCOS to rootful Podman.

## Phase 5 — CI/CD and health
- [ ] Protect pxe-production, host-vm-production, fcos-production and kasm-poc environments.
- [ ] Store private keys and pre-verified known_hosts in GitHub secrets.
- [ ] Validate Butane, Ansible syntax/lint, shell scripts and workflow YAML.
- [ ] Run Deploy Host OS, Deploy Host VM, Provision Services/Containers and Health Check independently.
- [ ] Run Kasm Compatibility POC separately on its isolated target.
- [ ] Test recovery and rollback.

## Phase 6 — Recovery
- [ ] Retain previous known-good Alpine PXE releases.
- [ ] Back up libvirt XML, FCOS QCOW2/base image and application state separately.
- [ ] Test previous PXE release selection and VM restore.
- [ ] Never automatically rebaseline AIDE after suspicious changes.
