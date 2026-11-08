# Diskless Home Infrastructure

Alpine Linux is the default physical host and boots disklessly through iPXE. Fedora CoreOS (FCOS) is the default guest VM and hosts rootless Podman, Docker-compatible CLI tooling, security services and the Kasm compatibility gate.

The Host VM workflow is deliberately independent of the Host OS workflow. The hypervisor may be Alpine (default), Fedora Secureblue, Arch Linux or Ubuntu, provided KVM/QEMU/libvirt, a bridge and persistent storage are already prepared. This permits manual OS installation, USB boot or another boot medium without changing VM deployment.

## Architecture

- **Host OS (default Alpine diskless):** iPXE boot, OpenRC, KVM/QEMU/libvirt, br0 bridge and optional persistent local NVMe mount.
- **Alternative hypervisors:** Fedora Secureblue, Arch Linux or Ubuntu. These are deployment targets only; the VM workflow does not install or reimage them.
- **FCOS VM:** Butane/Ignition configures SSH, static networking, Firewalld, Suricata NFQUEUE, rootless Podman and daily systemd scan services. Ansible layers missing RPMs, validates IDS/IPS and tests Compose.
- **Kasm:** separate fail-closed compatibility POC on an isolated FCOS test VM. It does not install Kasm automatically.
- **Storage:** live VM disks, Ignition and libvirt XML must be on persistent local storage. NAS/SMB is suitable for PXE artifacts and backups, not the live qcow2 disk by default.
- **CI/CD:** root-level GitHub Actions workflows use protected environments, SSH secrets and Ansible.

## Independent workflows

| Workflow | Scope | Prerequisite |
|---|---|---|
| Deploy Host OS | Build and publish Alpine netboot assets, iPXE menu and apkovl | Independent PXE HTTP/TFTP publisher and router/firmware PXE settings |
| Deploy Host VM | Provision FCOS on an existing hypervisor | KVM/QEMU/libvirt, bridge and persistent local storage already prepared |
| Provision Services/Containers | Layer packages, configure security services, validate IDS/IPS and test rootless Compose | Reachable FCOS VM, SSH key and preapproved container image |
| Health Check | Validate hypervisor, FCOS services, firewall, timers and rootless Podman | Reachable targets and pinned known_hosts |
| Kasm Compatibility POC | Check Docker Engine and Compose v2 requirements | Isolated FCOS test VM and separate credentials |

Deploy Host VM never invokes or requires Deploy Host OS. Alpine PXE is the default host lifecycle, not a hard dependency.

## Deployment sequence

1. Prepare PXE services and router/firmware boot settings.
2. Run Deploy Host OS and PXE boot Alpine, or manually prepare another supported hypervisor.
3. For diskless Alpine, provide the UUID of an already formatted ext4 NVMe partition to the Host OS workflow. The workflow does not partition or format disks.
4. Run Deploy Host VM with a persistent storage path; the playbook rejects tmpfs/overlay storage.
5. Run Provision Services/Containers, then Health Check.
6. Run Kasm Compatibility POC only against an isolated FCOS test VM.

## Network defaults

- LAN: 192.168.1.0/24
- FCOS VM: 192.168.1.20/24
- Gateway/DNS: 192.168.1.1
- FCOS NIC: enp1s0
- Alpine physical NIC: enp1s0 by default; host IP is assigned to bridge br0
- FCOS SSH: public-key only, allowed from the trusted LAN
- Firewalld inbound: default DROP with a LAN-only SSH exception
- Firewalld host egress: explicit source address, HTTP/HTTPS, DNS and NTP

Update Butane and inventory together if the FCOS IP, NIC or LAN changes. Kasm HTTPS ingress is not opened by the baseline firewall; add a narrowly scoped ingress policy only after the Kasm POC passes.

## Persistent storage

For Alpine diskless, the Host OS workflow can configure an existing ext4 partition by UUID, mounted at /mnt/nvme by default. FCOS base/overlay QCOW2, Ignition and persistent libvirt XML are stored under /mnt/nvme/libvirt/images. An OpenRC service restores the domain definition and starts FCOS after the storage mount and libvirtd are ready.

If no storage UUID is supplied, Alpine still boots, but Deploy Host VM rejects the diskless root filesystem as VM storage. If you customize the VM storage directory, use the same value in both Host OS and Host VM workflows so the OpenRC restore service finds the domain XML. The workflow never partitions or formats the NVMe. Runtime LBU backup/persistence for arbitrary Alpine configuration changes remains a separate operation.

## Resource constraint

The physical host has 8 GB RAM and an Intel i3-10320. Kasm currently documents 4 GB RAM/2 CPU cores as its minimum host requirement, while its default workspace is configured for 2768 MB RAM and 2 CPU cores. That leaves insufficient headroom for Alpine, FCOS, Kasm services and a default workspace on this 8 GB host. Treat the current Kasm POC as an API/version compatibility test only. Do not attempt a default workspace lifecycle test until the host has more memory or a deliberately reduced custom workspace profile has been validated.

See architecture, deployment plan, PXE automation, Alpine host and Ansible operations documentation.
