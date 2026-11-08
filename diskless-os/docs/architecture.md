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

FCOS is provisioned from a pinned QCOW2 image and Ignition configuration. Butane writes the FCOS core SSH key, SSH hardening, Firewalld zone and egress policy, NFQUEUE nftables rules, rootless Podman user socket defaults, security scan scripts, systemd services and timers, and baseline kernel sysctl hardening.

Butane does not install RPM packages. The FCOS image must include Firewalld, nftables, Suricata with NFQUEUE support, suricata-update, AIDE, ClamAV, Lynis, Podman and podman-compose. A separate package-image or rpm-ostree layering/reboot stage must complete before these units are relied on. Do not assume packages installed in a Toolbox exist in FCOS.

Rootless Podman is configured for the `core` user. The user socket is `/run/user/1000/podman/podman.sock`; linger keeps the user manager available. The Docker-compatible environment exports both `CONTAINER_HOST` and `DOCKER_HOST`, and provides interactive aliases. The rootful system-level Podman and Docker services/sockets are masked. The aliases/API socket do not prove Kasm compatibility.

## Kasm compatibility gate

Kasm's documented requirements specify Docker Engine and Docker Compose versions. Fedora CoreOS is not explicitly named in the supported operating-system list. Rootless Podman is not an officially declared replacement for Docker Engine. The POC must validate:
1. Docker CLI version output and daemon/API behavior.
2. Docker Compose command behavior and version.
3. Kasm installer preflight and service creation.
4. Container networking, volumes, capabilities and systemd lifecycle.
5. HTTPS login and at least one workspace launch/stop cycle.

The POC must fail closed when prerequisites are not met. Do not run the production installer automatically as part of normal provisioning.

## Suricata traffic scope

Suricata runs NFQUEUE queue 0 on ingress and egress of `enp1s0`. HOME_NET is `192.168.1.0/24`. The nftables queue rules use `bypass` to preserve connectivity when the daemon is unavailable; this is fail-open and must be monitored. The configured chains inspect traffic to/from the FCOS host, not arbitrary traffic between other LAN clients. Transit IPS requires routing/bridging or mirrored traffic and separate FORWARD queue rules.

## Firewall

Firewalld uses a default-DROP inbound zone on `enp1s0`. SSH is the only inbound exception and is limited to `192.168.1.0/24`. A HOST-to-ANY egress policy uses source address `192.168.1.20` and permits HTTP, HTTPS, DNS and NTP, including explicit TCP ports 80 and 443. Other host-originated IPv4 egress is dropped. Update both Butane and inventory if the FCOS LAN address changes. Container egress is a separate policy surface and must be tested.

## Storage and recovery

Keep VM disks and Kasm/application state on durable storage. Keep boot artifacts versioned and checksummed. Retain the previous Alpine PXE release. Back up VM definitions, FCOS disk and application data independently. Never automatically regenerate an AIDE baseline after unexplained changes.
