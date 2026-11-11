# vm-host — Fedora CoreOS VM with Kasm Workspaces

Builds a hardened Fedora CoreOS VM with Kasm workspaces, straight from the
hypervisor. No CI, no Ansible.

**→ Run it: see [GUIDE.md](GUIDE.md)** (3 commands, from zero to workspaces.)

```bash
export FCOS_SSH_PUBLIC_KEY='ssh-ed25519 ...'
export FCOS_CORE_PASSWORD_HASH="$6$..."   # openssl passwd -6
run0 make deploy
```

## Layout

```text
vm-host/
├── GUIDE.md                 # start here — quick guide
├── Makefile                 # deploy, status, ssh, console, logs, clean
├── build.sh                 # render config.bu → vm-host.ign (butane --strict)
├── deploy.sh                # fetch FCOS image, create disk, boot VM (fw_cfg Ignition)
├── config.bu                # root Butane config
├── 1_host_level/            # /etc drop-ins (sshd, journald, sysctl, suricata, clamav, aide, firewalld)
├── 2_systemd_level/         # first-boot units: security-setup (layers pkgs + 1 reboot) → security-finalize
└── 3_container_level/kasm/  # docker-compose.yaml for the workspaces
```

## What happens when you deploy

1. `build.sh` renders `config.bu` + fragments into a single Ignition file.
2. `deploy.sh` downloads the FCOS stable image (sha256-verified), creates a
   writable overlay disk, and boots the VM with the Ignition file attached
   (**first boot only** — later boots use the disk).
3. First boot: `security-setup.service` installs the packages
   (firewalld, suricata, clamav, aide, lynis, docker) and reboots once.
4. Second boot: `security-finalize.service` applies the firewall, IDS rules
   and starting points, then `kasm-workspace.service` starts the workspaces.

Workspaces (on the VM, default `192.168.1.201`, standalone KasmVNC containers):
Ubuntu desktop `:6901`, LibreWolf `:3101`, Arch XFCE `:3201`. Login is the
VNC password generated on first boot — `sudo cat /var/opt/kasm/.env` on the
VM. The home-security.uk stack publishes on `127.0.0.1` only — reach it over
an SSH tunnel.

## Notes worth knowing

- **Never destructive**: `deploy.sh` refuses to overwrite an existing VM;
  removal is always the explicit `make clean`.
- **Kasm install**: `install.sh --accept-eula --no-swap-check` (FCOS has no
  swap; ZRAM only).
- **No GPU passthrough** — KasmVNC falls back to software rendering (MESA
  llvmpipe); forcing DRI3 breaks workspace launches.
- **Windows workspaces are not containers** — register the Windows host in
  Kasm as a Server (RDP); TCP 3389 outbound is allowed on the LAN.
- **DNS**: use the host bridge (`br0`) for the guest network — SLIRP DNS is
  unreliable on this host.
- Edit any fragment/unit, then `make clean && run0 make deploy` to rebuild.
