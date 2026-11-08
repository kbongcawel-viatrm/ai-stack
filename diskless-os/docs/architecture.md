# Architecture

```text
GitHub Actions
  |-- Deploy Host OS ----------------> PXE publisher
  |                                      |-- iPXE menu
  |                                      |-- Alpine kernel/initramfs/modloop
  |                                      v
  |                                  Alpine diskless host (default)
  |
  |-- Deploy Host VM ----------------> Existing hypervisor
  |                                      |-- KVM/QEMU/libvirt
  |                                      v
  |                                  Fedora CoreOS VM
  |
  |-- Provision Services/Containers -> Ansible -> FCOS
  |                                      |-- rootless Podman/API
  |                                      |-- Firewalld
  |                                      |-- Suricata NFQUEUE
  |                                      |-- AIDE / ClamAV / Lynis timers
  |                                      |-- Compose smoke stack
  |                                      |-- gated Kasm POC
  |
  |-- Health Check ------------------> Host + FCOS
```

## Host OS abstraction

Alpine diskless PXE is the default host lifecycle. It is not a dependency of VM provisioning. The VM workflow targets an existing hypervisor and requires working `virsh`, `qemu-img`, KVM and a preconfigured bridge/storage path. Supported host choices are Alpine, Fedora Secureblue, Arch Linux and Ubuntu; the workflow does not install or mutate those host operating systems.

## FCOS guest

FCOS is provisioned from a pinned QCOW2 image and Ignition configuration. Ansible configures the guest after SSH becomes reachable. Required FCOS packages must be present in the image or layered with an explicit reboot; do not assume Toolbox packages exist in the VM.

Rootless Podman is configured for the `core` user. The user socket is `/run/user/<uid>/podman/podman.sock`; linger keeps the user manager available. The Docker-compatible wrapper and interactive aliases are convenience interfaces, not proof that every Docker API/Compose behavior is supported.

## Kasm compatibility gate

Kasm's documented requirements specify Docker Engine and Docker Compose versions. Fedora CoreOS is not explicitly named in the supported operating-system list. Rootless Podman is not an officially declared replacement for Docker Engine. The POC must validate:
1. Docker CLI version output and daemon/API behavior.
2. Docker Compose command behavior and version.
3. Kasm installer preflight and service creation.
4. Container networking, volumes, capabilities and systemd lifecycle.
5. HTTPS login and at least one workspace launch/stop cycle.

The POC must fail closed when prerequisites are not met. Do not run the production installer automatically as part of normal provisioning.

## Suricata traffic scope

Suricata runs NFQUEUE mode on `enp1s0`. The host INPUT and OUTPUT paths are queued. This protects and inspects traffic addressed to/from the FCOS VM. It does not automatically inspect other LAN clients. To inspect transit traffic, FCOS must be an actual router/bridge or receive mirrored traffic; optional FORWARD queueing is disabled by default.

The NFQUEUE nftables rules use queue bypass so traffic is not stranded if Suricata is unavailable. IPS effectiveness is validated with a controlled second LAN endpoint and temporary test signatures.

## Firewall

Firewalld uses a default-DROP inbound zone. SSH is the only inbound exception and is limited to `192.168.1.0/24`. A HOST-to-ANY egress policy uses the explicit FCOS LAN source address and permits HTTP, HTTPS, DNS and NTP plus explicitly configured ports. This is host egress policy, not a blanket allowance for all forwarded/container traffic.

## Storage and recovery

Keep VM disks and Kasm/application state on durable storage. Keep boot artifacts versioned and checksummed. Retain the previous Alpine PXE release. Back up VM definitions, FCOS disk and application data independently. Never automatically regenerate an AIDE baseline after unexplained changes.
