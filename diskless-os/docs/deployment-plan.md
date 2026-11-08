# Deployment Plan

## Phase 0 — Prerequisites and recovery
- [ ] Record NIC names/MACs, BIOS/UEFI mode, Secure Boot and PXE/iPXE capability.
- [ ] Confirm router DHCP behavior; do not run competing DHCP servers.
- [ ] Confirm PXE HTTP/TFTP publisher path and storage permissions.
- [ ] Reserve host, FCOS and PXE addresses.
- [ ] Confirm hypervisor KVM/QEMU/libvirt, bridge and durable storage before running Deploy Host VM.
- [ ] Back up existing VM/storage and keep console recovery.

## Phase 1 — Host OS (independent workflow)
- [ ] Run Deploy Host OS with a pinned Alpine release (default target: Alpine 3.24.4 x86_64).
- [ ] Verify downloaded netboot archive against Alpine's published SHA-256 file.
- [ ] Publish versioned boot assets and promote the current symlink only after remote checksum verification.
- [ ] Configure router PXE boot options or proxy-DHCP/TFTP on a separate service.
- [ ] PXE boot and validate Alpine diskless mode/LBU.
- [ ] Alternatively, prepare a manually installed Secureblue, Arch or Ubuntu host.

## Phase 2 — Host VM (does not depend on Phase 1)
- [ ] Set the hypervisor inventory target and `host_os` (alpine, secureblue, arch or ubuntu).
- [ ] Confirm `virsh`, `qemu-img`, KVM and the selected bridge already exist.
- [ ] Supply a pinned FCOS QCOW2 URL and FCOS SSH public key.
- [ ] Generate Ignition from Butane and provision the FCOS VM.
- [ ] Verify FCOS SSH and guest network reachability.

## Phase 3 — FCOS provisioning
- [ ] Configure rootless Podman user socket and linger.
- [ ] Configure `CONTAINER_HOST`, interactive `docker`/`docker-compose` aliases and non-interactive Docker wrapper.
- [ ] Configure Firewalld inbound default DROP and explicit LAN-source egress policy.
- [ ] Configure Suricata NFQUEUE on `enp1s0`, LAN `192.168.1.0/24`, and free rule sources.
- [ ] Run `suricata -T -c /etc/suricata/suricata.yaml` before enabling the service.
- [ ] Validate IDS alert and IPS drop using a second LAN test endpoint.
- [ ] Create daily ClamAV, Lynis and AIDE systemd services/timers.
- [ ] Initialize and review AIDE baseline manually before enabling its timer.
- [ ] Deploy the rootless Podman Compose smoke stack.

## Phase 4 — Kasm POC gate
- [ ] Confirm Kasm's current supported OS and Docker/Compose requirements.
- [ ] Verify the FCOS Podman wrapper passes the CLI/API/Compose checks.
- [ ] Run installer preflight in an isolated snapshot/clone, not on the production guest.
- [ ] Validate Kasm services, networking, storage, HTTPS and one workspace lifecycle.
- [ ] If any gate fails, stop and decide whether Kasm must move to a separately supported host. Do not silently switch the FCOS VM to rootful Podman.

## Phase 5 — CI/CD and health
- [ ] Protect the `pxe-production`, `host-vm-production` and `fcos-production` environments.
- [ ] Store private keys and pre-verified known_hosts in GitHub secrets.
- [ ] Validate Butane, Ansible syntax/lint, shell and workflow YAML.
- [ ] Run the four independent workflows and inspect their logs.
- [ ] Test recovery and rollback.

## Phase 6 — Recovery
- [ ] Retain previous known-good Alpine PXE release.
- [ ] Back up libvirt XML, FCOS QCOW2 and Kasm/application state separately.
- [ ] Test previous PXE release selection and VM restore.
- [ ] Never automatically rebaseline AIDE after suspicious changes.
