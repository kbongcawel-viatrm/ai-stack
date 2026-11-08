# Deployment Plan

## Phase 0 — Prerequisites and recovery
- [ ] Record NIC names/MACs, BIOS/UEFI mode, Secure Boot and PXE/iPXE capability.
- [ ] Confirm router DHCP behavior; do not run competing DHCP servers.
- [ ] Confirm PXE HTTP/TFTP publisher path and storage permissions.
- [ ] Reserve host, FCOS and PXE addresses.
- [ ] Confirm hypervisor KVM/QEMU/libvirt, bridge and durable storage before running Deploy Host VM.
- [ ] Back up existing VM/storage and keep console recovery.

## Phase 1 — Host OS (independent workflow)
- [ ] Run **Deploy Host OS** with pinned Alpine 3.24.4 x86_64.
- [ ] Verify downloaded netboot archive against Alpine's published SHA-256 file.
- [ ] Build the version-controlled apkovl with root public key, host NIC and hypervisor packages.
- [ ] Publish versioned kernel/initramfs/modloop/apkovl and promote the current symlink only after remote checksum verification.
- [ ] Configure router PXE boot options or proxy-DHCP/TFTP on a separate service.
- [ ] PXE boot and validate Alpine diskless startup, SSH, OpenRC, KVM modules and libvirtd.
- [ ] Configure writable LBU persistence separately if runtime changes must survive reboot; the current apkovl is a read-only HTTP artifact.
- [ ] Alternatively, prepare a manually installed Secureblue, Arch or Ubuntu host.

## Phase 2 — Host VM (does not depend on Phase 1)
- [ ] Set the hypervisor target and `host_os` (alpine, secureblue, arch or ubuntu).
- [ ] Confirm `virsh`, `qemu-img`, KVM and the selected bridge already exist.
- [ ] Supply a pinned, uncompressed FCOS QCOW2 URL and SHA-256 plus the FCOS SSH public key.
- [ ] Render/validate Butane, generate Ignition and provision the FCOS VM.
- [ ] Verify FCOS static IP, SSH and guest network reachability.
- [ ] Back up the FCOS base image, overlay disk and libvirt XML.

## Phase 3 — FCOS provisioning
- [ ] Run **Provision Services/Containers** with package layering enabled if required; allow the controlled FCOS reboot.
- [ ] Configure rootless Podman user socket and linger.
- [ ] Configure `CONTAINER_HOST`, `DOCKER_HOST` and interactive `docker`/`docker-compose` aliases.
- [ ] Configure Firewalld inbound default DROP and explicit source-bound LAN egress policy.
- [ ] Configure Suricata NFQUEUE on `enp1s0`, HOME_NET `192.168.1.0/24`, ET Open and local rules.
- [ ] Run `suricata -T -c /etc/suricata/suricata.yaml --include /etc/suricata/fcos-overrides.yaml` before enabling the service.
- [ ] Validate IDS alert and IPS drop using a controlled HTTP endpoint on a second LAN host.
- [ ] Create daily ClamAV, Lynis and AIDE systemd services/timers. AIDE timer remains disabled until its baseline is reviewed.
- [ ] Use the existing `podwhitelist` function inside FCOS to approve/pull the exact Compose smoke image.
- [ ] Validate rootless Podman Compose start/HTTP/stop lifecycle.

## Phase 4 — Kasm POC gate
- [ ] Confirm Kasm's current Docker Engine and Docker Compose requirements.
- [ ] Run **Kasm Compatibility POC** on an isolated FCOS test VM, not the production guest.
- [ ] Verify Docker API identity and Docker Compose v2 version. Podman identity or missing Compose v2 fails the gate.
- [ ] Do not run the Kasm installer unless the Docker/Compose gate passes.
- [ ] If the gate passes, perform the installer, service, storage, networking, HTTPS and workspace lifecycle tests on the isolated VM.
- [ ] If any gate fails, stop and decide whether Kasm needs a separately supported runtime. Do not silently switch FCOS to rootful Podman.

## Phase 5 — CI/CD and health
- [ ] Protect `pxe-production`, `host-vm-production`, `fcos-production` and `kasm-poc` environments.
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
