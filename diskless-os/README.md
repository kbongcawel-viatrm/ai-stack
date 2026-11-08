# Diskless Home Infrastructure

Alpine Linux is the default physical host and boots disklessly through iPXE. Fedora CoreOS (FCOS) is the default guest VM and hosts rootless Podman, Docker-compatible CLI tooling, security services and the Kasm compatibility proof of concept.

The host-VM workflow is deliberately independent of the host-OS workflow. The hypervisor may be Alpine (default), Fedora Secureblue, Arch Linux or Ubuntu, provided KVM/QEMU/libvirt are already installed and reachable. This permits a manual install, USB boot or another boot medium without changing the VM deployment pipeline.

## Architecture

- **Host OS (default Alpine diskless):** PXE/iPXE boot, OpenRC, KVM/QEMU/libvirt and durable VM storage. The version-controlled apkovl is the boot configuration source of truth; writable LBU persistence is a separate setup and is not currently automated.
- **Alternative hypervisors:** Fedora Secureblue, Arch Linux or Ubuntu. These are supported as deployment targets only when virtualization prerequisites are prepared separately.
- **FCOS VM:** Butane/Ignition lays down SSH hardening, Firewalld zone/policy XML, Suricata NFQUEUE configuration and nftables hooks, rootless Podman user socket, Docker environment exports and interactive aliases, and systemd scan/update units. Ansible installs/updates required packages, initializes rule databases, runs validation and enables gated services.
- **Kasm:** compatibility POC inside FCOS. Production install is gated until Kasm's Docker/Compose requirements and rootless Podman behavior pass an end-to-end test.
- **Storage:** VM disks and persistent application data live on durable storage. NAS/SMB is storage only unless it separately provides DHCP/PXE/TFTP/HTTP.
- **CI/CD:** root-level GitHub Actions workflows use a protected self-hosted runner and Ansible.

## Deployment workflows

| Workflow | Scope | Independent prerequisite |
|---|---|---|
| Deploy Host OS | Build, verify and publish Alpine netboot assets and iPXE menu | PXE HTTP/TFTP publisher and router/firmware PXE configuration |
| Deploy Host VM | Provision FCOS VM on an existing hypervisor | Existing host OS with KVM/QEMU/libvirt and bridge/storage ready |
| Provision Services/Containers | Configure FCOS rootless Podman, firewall, Suricata, AIDE, ClamAV, Lynis and Compose smoke stack | Reachable FCOS VM and SSH credentials |
| Health Check | Run Ansible checks against configured host and FCOS targets | Reachable targets and known_hosts |
| Kasm Compatibility POC | Test Docker Engine and Compose v2 compatibility on isolated FCOS | Isolated FCOS test VM and separate SSH credentials |

The host VM workflow does not invoke or require Deploy Host OS. Alpine is the default, not a hard dependency. The Kasm POC is separate from service provisioning and never installs Kasm automatically.

## Deployment order

1. Prepare PXE services and router/firmware boot settings.
2. Run **Deploy Host OS** to publish a pinned Alpine netboot release; PXE boot the host.
3. Alternatively, manually install Alpine, Secureblue, Arch or Ubuntu and prepare KVM/QEMU/libvirt.
4. Run **Deploy Host VM** to create the FCOS guest on the prepared hypervisor.
5. Run **Provision Services/Containers** to configure FCOS.
6. Run the **Health Check** workflow.
7. Run the Kasm POC gate. Do not install production Kasm until the installer, API, Compose, services and workspace lifecycle pass.

## Network defaults

- LAN: `192.168.1.0/24`
- FCOS VM example: `192.168.1.20`
- Alpine host example: `192.168.1.10`
- FCOS capture/management NIC: `enp1s0`
- FCOS SSH: public-key only, allowed from the LAN CIDR.
- Firewalld inbound: default DROP with a restricted LAN SSH exception.
- Firewalld host egress: explicit source address and HTTP/HTTPS; DNS/NTP are included for basic operation. Additional egress ports must be explicitly declared.

Change the example IPs in Ansible inventory before deployment. The egress policy requires the FCOS LAN host address as an explicit variable.

## Resource constraint

The physical host has 8 GB RAM and an Intel i3-10320. FCOS plus Kasm services and a workspace may exceed available memory. Start with no more than one test workspace, measure memory/swap/IO, and do not assume Kasm's documented minimums are sufficient for this host.

## Repository layout

- `.github/workflows/`: executable GitHub Actions workflows (must be at repository root).
- `diskless-os/ansible/`: inventories, playbooks and roles.
- `diskless-os/alpine/`: diskless host notes and validation.
- `diskless-os/pxe/`: iPXE and dnsmasq configuration.
- `diskless-os/butane/`: FCOS Ignition source.
- `diskless-os/services/`: service and container configuration.
- `diskless-os/docs/`: architecture, deployment plan and runbooks.

See [architecture](docs/architecture.md), [deployment plan](docs/deployment-plan.md), [PXE automation](docs/pxe-automation.md) and [Ansible operations](ansible/README.md).
