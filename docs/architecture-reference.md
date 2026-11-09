# Similar reference architectures combine immutable container-focused Linux distributions (such as Fedora CoreOS or Flatcar Container Linux) provisioned declaratively via Ignition/Butane with containerized remote desktop gateways (like Kasm Workspaces or Apache Guacamole) and policy-routed VPN isolation.
Because your topology separates host management (10.1.29.0/24) from a bridged Layer 2 interface (br0 on 192.168.1.0/24), public reference setups fall into four architectural patterns that mirror different parts of your stack:
https://github.com/coreos/ignition/blob/main/butane/docs/getting-started.md
https://github.com/flatcar

## 1. Immutable OS + Declarative Butane/Ignition + Ansible

• CoreOS / Flatcar Declarative Provisioning: The official CoreOS Ignition & Butane Documentation and Flatcar Container Linux ecosystems use the exact ignition.config.merge pattern to compose modular system units, network profiles, and package layers at boot.
• Post-Boot Configuration Management: Guides such as OneUptime's CoreOS/Flatcar Ansible Architecture follow the same two-phase split you built—using Ignition for immutable OS bootstrapping and Ansible over SSH (ansible_python_interpreter=/usr/bin/python3) for application-layer API setup.
https://oneuptime.com/blog/post/2026-02-21-ansible-configure-coreos-flatcar-linux/view

## 2. Per-Network VPN Isolation for Kasm Workspaces

• Gluetun + Kasm Custom Docker Networks: A widely used community pattern on Reddit's r/kasmweb pairs a Gluetun VPN container with Kasm's Restrict Image to Docker Network feature. Instead of routing all containers through wg0 via host ip rule tables, this pattern lets you attach specific workspace images (such as Firefox) to a VPN-routed Docker bridge while leaving administrative containers on the default network.
https://www.reddit.com/r/kasmweb/comments/1jk6ihw/route_docker_kasm_with_gluetun_vpn/

• Container-Sidecar WireGuard Kill-Switches: Projects like jordanpotter/docker-wireguard implement the same fwmark + iptables/nftables drop rules inside a dedicated network namespace so container traffic cannot leak if the WireGuard handshake drops, while explicitly exempting local LAN subnets (LOCAL_SUBNETS).
• In-Container VPN Profiles: For per-session VPN switching, Kasm's Official VPN-Inside-Container Guide documents passing /dev/net/tun into individual workspace containers to run WireGuard, Tailscale, or OpenVPN directly inside the desktop session.
https://github.com/jordanpotter/docker-wireguard
https://docs.kasm.com/docs/how-to/networking/vpn-inside-container

## 3. Dual-Subnet / Bypassed-NAT Bridge Topologies
https://openwrt.org/docs/guide-user/network/wifi/wifiextenders/bridgedap
• Multi-Homed Management vs. Bridged Data Plane: Your network diagram (routing host management through a secondary router on 10.1.29.0/24 while bridging a dedicated NIC directly to the primary 192.168.1.0/24 ISP router) mirrors standard homelab segmentation designs—such as those documented in OpenWrt Bridged AP Topologies and Super User Subnet Isolation Threads—where management traffic stays behind an internal NAT while servers or VMs take a direct Layer 2 address on the upstream subnet.
## 4. Comparable Browser-Streamed Workspace & Security Labs
https://www.linkedin.com/posts/housenathan_7-free-remote-desktops-you-can-run-in-a-browser-activity-7517525290282139649-5KPW
• Browser-Based VDI Alternatives: Security overviews like Nathan House's Browser Remote Desktop Comparison group Kasm Workspaces alongside Apache Guacamole (for pure RDP/SSH browser proxying to Windows hosts) and LinuxServer Webtop (for lightweight containerized Alpine/Ubuntu desktops) behind VPN-restricted access.
If you want to explore any of these reference patterns further, I can compare Gluetun per-workspace Docker networks against your host-level wg0 policy routing, or show how to configure Kasm's built-in Docker network restrictions via Ansible. Would either be helpful?
