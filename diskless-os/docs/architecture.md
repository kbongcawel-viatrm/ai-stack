# Architecture

    GitHub Actions
      |-- Deploy Host OS ----------------> PXE publisher
      |                                      |-- iPXE menu
      |                                      |-- Alpine kernel/initramfs/modloop/apkovl
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
      |                                      |-- Compose HTTP smoke test
      |                                      |-- gated Kasm POC
      |
      |-- Health Check ------------------> Host + FCOS

## Host OS abstraction

Alpine diskless PXE is the default host lifecycle. It is not a dependency of VM provisioning. The VM workflow targets an existing hypervisor and requires working virsh, qemu-img, KVM and a preconfigured bridge/storage path. Supported host choices are Alpine, Fedora Secureblue, Arch Linux and Ubuntu; the workflow does not install or mutate those host operating systems.

The Alpine apkovl configures a physical NIC as a bridge port and assigns DHCP to br0. The FCOS guest attaches directly to br0 and uses its reserved static LAN address.

## Persistent storage

The Alpine root filesystem is diskless and volatile. The Host OS workflow can optionally mount a preformatted ext4 partition by UUID (default mountpoint /mnt/nvme). The Host VM workflow requires the FCOS image directory to resolve to local persistent storage (ext4, XFS, Btrfs or F2FS); it refuses tmpfs, overlay and network filesystems.

FCOS base/overlay QCOW2, Ignition and libvirt domain XML live under the selected persistent directory. The Alpine apkovl optionally enables an OpenRC libvirt-vms service that waits for localmount/libvirtd, restores the domain XML and starts FCOS after reboot. No disk partitioning or formatting is automated. For Secureblue, Arch or Ubuntu, the workflow uses the existing persistent filesystem and libvirt installation.

## FCOS guest

FCOS is provisioned from a pinned QCOW2 image and Ignition configuration. Butane writes the FCOS core SSH key, SSH hardening, static NetworkManager profile, Firewalld zone and egress policy, NFQUEUE nftables rules, rootless Podman user socket defaults, scan scripts, systemd services/timers and kernel/sysctl hardening.

Butane does not install RPM packages. The FCOS package layer must include Firewalld, nftables, Suricata with NFQUEUE support, suricata-update, AIDE, ClamAV, Lynis, Podman and podman-compose. A separate rpm-ostree layering/reboot stage completes before services are relied on. Do not assume packages installed in a Toolbox exist in FCOS.

Rootless Podman is configured for the core user. The user socket is /run/user/1000/podman/podman.sock; linger keeps the user manager available. Both CONTAINER_HOST and DOCKER_HOST point to that Unix socket. Interactive docker/docker-compose aliases are convenience interfaces, not proof that every Docker API/Compose behavior is supported. Rootful system Podman/Docker sockets are masked.

## Kasm compatibility gate

Kasm's documented requirements specify Docker Engine and Docker Compose versions. Fedora CoreOS is not explicitly named as a validated host OS, and rootless Podman is not an officially declared replacement for Docker Engine. The isolated POC checks Docker CLI/server identity, server version, Docker Compose v2 availability/version and rootless engine identity. It fails closed when the endpoint identifies as Podman or the required Compose v2 plugin is absent. It does not install Kasm. Only if this gate passes should an operator run the pinned Kasm installer on the isolated test VM and validate services, volumes, networking, HTTPS and a workspace launch/stop cycle.

## Suricata traffic scope

Suricata runs NFQUEUE queue 0 on ingress and egress of enp1s0. HOME_NET is 10.1.29.0/24. nftables queue rules run before the Firewalld filter hook and use bypass to preserve connectivity when the daemon is unavailable; this is fail-open and must be monitored. The configured chains inspect traffic to/from the FCOS host, not arbitrary traffic between other LAN clients. Transit IPS requires routing/bridging or mirrored traffic and separate FORWARD queue rules.

## Firewall

Firewalld uses a default-DROP inbound zone on enp1s0. SSH is the only inbound exception and is limited to 10.1.29.0/24. A HOST-to-ANY egress policy uses source address 10.1.29.100 and permits HTTP, HTTPS, DNS and NTP, including explicit TCP ports 80 and 443. Other host-originated IPv4 egress is dropped. Update both Butane and inventory if the FCOS LAN address changes. Container egress is a separate policy surface and must be tested.

Kasm HTTPS ingress is intentionally not opened by the baseline firewall. Add a narrowly scoped 443 rule only after the compatibility gate passes.

## Recovery

Retain previous Alpine PXE releases, back up libvirt XML and FCOS QCOW2/base images, and back up application state independently. Never automatically regenerate an AIDE baseline after unexplained changes.
