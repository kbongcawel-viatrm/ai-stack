# Diskless Home Infrastructure

Alpine Linux is the default physical host and boots disklessly through iPXE. Fedora CoreOS (FCOS) is the default guest VM and hosts rootless Podman, Docker-compatible CLI tooling, security services and the Kasm compatibility gate.

The Host VM workflow is deliberately independent of the Host OS workflow. The hypervisor may be Alpine (default), Fedora Secureblue, Arch Linux or Ubuntu, provided KVM/QEMU/libvirt, a bridge and persistent storage are already prepared. This permits manual OS installation, USB boot or another boot medium without changing VM deployment.

## Architecture

- **Host OS (default Alpine diskless):** iPXE boot, OpenRC, KVM/QEMU/libvirt, br0 bridge and optional persistent local NVMe mount.
- **Alternative hypervisors:** Fedora Secureblue, Arch Linux or Ubuntu. These are deployment targets only; the VM workflow does not install or reimage them.
- **FCOS VM:** Butane/Ignition configures SSH, static networking, Firewalld, Suricata, Kasm workspaces and daily systemd scan services. The primary provisioning path is the direct host-side driver in `../vm-host/` (`make deploy`: render Ignition → provision the VM on the hypervisor). Ansible playbooks and GitHub Actions workflows remain available as an alternative.
- **Kasm:** three standalone KasmVNC workspaces and a security monitoring stack, provisioned by the VM's first-boot services (see `../vm-host/GUIDE.md`).
- **Storage:** live VM disks, Ignition and libvirt XML must be on persistent local storage. NAS/SMB is suitable for PXE artifacts and backups, not the live qcow2 disk by default.
- **CI/CD:** optional GitHub Actions workflows with SSH secrets and Ansible; the default path is direct host-side deployment (no CI).

## Independent workflows

| Workflow | Scope | Prerequisite |
|---|---|---|
| Deploy Host OS | Build and publish Alpine netboot assets, iPXE menu and apkovl | Independent PXE HTTP/TFTP publisher and router/firmware PXE settings |
| Deploy Host VM | Provision FCOS on an existing hypervisor | KVM/QEMU/libvirt, bridge and persistent local storage already prepared |
| Provision Services/Containers | Layer packages, configure security services, validate IDS/IPS and test rootless Compose | Reachable FCOS VM, SSH key and preapproved container image |
| Health Check | Validate hypervisor, FCOS services, firewall, timers and rootless Podman | Reachable targets and pinned known_hosts |
| Kasm Compatibility POC | Check Docker Engine and Compose v2 requirements | Isolated FCOS test VM and separate credentials |

Deploy Host VM never invokes or requires Deploy Host OS. Alpine PXE is the default host lifecycle, not a hard dependency.

The workflows above are the optional CI path. The default deployment path runs directly on the hypervisor — `../vm-host/` renders the Ignition config and provisions the VM in one command (`run0 make deploy` on Secureblue). See `../vm-host/GUIDE.md` for the step-by-step runbook.

## Deployment sequence

1. Prepare PXE services and router/firmware boot settings.
2. Run Deploy Host OS and PXE boot Alpine, or manually prepare another supported hypervisor (Fedora Secureblue is the current physical hypervisor).
3. For diskless Alpine, provide the UUID of an already formatted ext4 NVMe partition to the Host OS workflow. The workflow does not partition or format disks.
4. Provision the FCOS VM directly on the hypervisor (`../vm-host`: `run0 make deploy`), or run Deploy Host VM with a persistent storage path; the playbook rejects tmpfs/overlay storage.
5. First boot layers packages and reboots once; security-finalize then applies the firewall, IDS rules and Kasm stack automatically.
6. Run Provision Services/Containers, then Health Check (CI path only).

## Network defaults

- LAN: 192.168.1.0/24
- FCOS VM: 192.168.1.201/24
- Gateway/DNS: 192.168.1.1
- FCOS NIC: ens2 (libvirt PCI slot 0x02)
- Hypervisor bridge: br0 at 192.168.1.100/24 (the physical NIC is enslaved to it; Alpine's enp1s0 default carries the same role on the Alpine path)
- FCOS SSH: public-key only, allowed from the trusted LAN
- Firewalld inbound: default DROP with a LAN-only SSH exception; Kasm workspace ports 6901/3101/3201 and HTTPS are opened by the vm-host zone

Update Butane and inventory together if the FCOS IP, NIC or LAN changes: the direct path takes `FCOS_LAN_IP`/`FCOS_INTERFACE`/`FCOS_GATEWAY` env vars (see `../vm-host/GUIDE.md`); the CI path uses the corresponding GitHub variables.

## Persistent storage

For Alpine diskless, the Host OS workflow can configure an existing ext4 partition by UUID, mounted at /mnt/nvme by default. FCOS base/overlay QCOW2, Ignition and persistent libvirt XML are stored under /mnt/nvme/libvirt/images. An OpenRC service restores the domain definition and starts FCOS after the storage mount and libvirtd are ready.

If no storage UUID is supplied, Alpine still boots, but Deploy Host VM rejects the diskless root filesystem as VM storage. If you customize the VM storage directory, use the same value in both Host OS and Host VM workflows so the OpenRC restore service finds the domain XML. The workflow never partitions or formats the NVMe. Runtime LBU backup/persistence for arbitrary Alpine configuration changes remains a separate operation.

## Resource constraint

The physical host has 8 GB RAM and an Intel i3-10320. Kasm currently documents 4 GB RAM/2 CPU cores as its minimum host requirement, while its default workspace is configured for 2768 MB RAM and 2 CPU cores. That leaves insufficient headroom for Alpine, FCOS, Kasm services and a default workspace on this 8 GB host. Treat the current Kasm POC as an API/version compatibility test only. Do not attempt a default workspace lifecycle test until the host has more memory or a deliberately reduced custom workspace profile has been validated.

See architecture, deployment plan, PXE automation, Alpine host and Ansible operations documentation.
