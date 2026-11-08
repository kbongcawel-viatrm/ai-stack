# Diskless Home Infrastructure

Alpine Linux is the PXE-booted physical hypervisor host. Fedora CoreOS (FCOS) runs security services. A dedicated Ubuntu Server VM runs Kasm Workspaces. GitHub Actions coordinates validation, deployment and health checks using the self-hosted runner labelled `home-server`.

## Components
- **Alpine:** diskless host, OpenRC, KVM/QEMU/libvirt; LBU persists required host state.
- **FCOS VM:** Suricata, Firewalld, AIDE, ClamAV and Lynis.
- **Ubuntu Server VM:** Kasm Workspaces on a dedicated supported Ubuntu Server host with Docker Engine.
- **TP-Link Archer AX55:** intended SMB storage. SMB is not itself a DHCP/PXE/TFTP service; verify firmware capabilities or deploy PXE services separately.
- **CI/CD:** GitHub Actions on `home-server`, using protected secrets/environments.

## Layout
- `docs/`: architecture, deployment plan, PXE automation and runbook.
- `pxe/`: dnsmasq example and iPXE menu.
- `alpine/`: host notes and validation script.
- `butane/`: FCOS Butane source.
- `ansible/`: inventory examples and operations guide.
- `services/`: service configuration notes.
- `.github/workflows/`: validation, health and gated PXE workflow.

## Deployment and Configuration management
```bash
                          GitHub Actions
                                |
                       Self-hosted LAN Runner
                                |
                                + runs
                                + 
                              Ansible            
           +--------------------+---------------------+
           |                    |                     |
         Deploy              Health               Services 
           |                    |                     |              
       +------------------------+-------------------------+
       |                      |                           |              
     Alpine OS               FCOS                         |
       |                      |                           |
       +----------------------+---------------------------+                                     
      OpenRC          +----- Services ---------------------- Podman
                      |      Suricata                          | (docker.socket)
      Networking      |      Firewalld                   Kasm Workspaces                              
      SSH             |      ClamAV                            |                                   
                      |      Aide                              + 
                      |      Lynis                             |       
                      +----- SSH               +---------------------------------+
                                               |                                 |                                     
                                          Workspace-1                       Workspace-N
                                         Firefox Browser       ...         
```
## Deployment order
1. Configure DHCP/PXE (router boot options or one dedicated DHCP/PXE service; never run competing DHCP servers).
2. Build/publish Alpine kernel/initramfs/rootfs and iPXE menu.
3. PXE boot Alpine; persist required settings with LBU.
4. Provision FCOS and Ubuntu VMs on durable storage.
5. Apply FCOS Butane/Ignition at first boot.
6. Apply Ansible for FCOS services, SSH/firewall, daily scans and health checks.
7. Install Kasm on the dedicated Ubuntu Server VM.
8. Verify network visibility, service health and application endpoints.

## Security boundaries
- FCOS SSH only from `192.168.1.0/24`; public-key authentication only; root remote login by key.
- Keep console access before changing SSH, networking or firewall rules.
- Butane generates Ignition for FCOS; it is not an Ubuntu/Kasm provisioning mechanism.
- Do not run Kasm server inside Toolbox; Toolbox is for development tools.
- Suricata sees only traffic delivered to its interface. NFQUEUE IPS needs explicit queue rules and NFQUEUE mode; passive capture is different.
- AIDE needs a trusted baseline reviewed and protected off-host before enabling its daily timer.
- FCOS Ansible is configuration-only; required packages must already be in the FCOS image.

Read [PXE automation](docs/pxe-automation.md) and [deployment plan](docs/deployment-plan.md).

