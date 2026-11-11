# vm-host — Quick Guide

Build and run a hardened Fedora CoreOS VM with Kasm workspaces, directly on
the hypervisor. No GitHub Actions, no Ansible.

## What you get

A VM (`10.1.29.201`) that on first boot installs and configures itself:
firewall, Suricata, ClamAV, AIDE, Lynis, and three browser workspaces:

| Workspace | Address |
|---|---|
| Ubuntu desktop | `https://10.1.29.201:6901` |
| LibreWolf browser | `https://10.1.29.201:3101` |
| Arch XFCE | `https://10.1.29.201:3201` |

## One-time host setup

The hypervisor needs: virtualization enabled (`/dev/kvm` exists), libvirt
running, and the `br0` bridge present.

```bash
ls -l /dev/kvm          # must exist
virsh -c qemu:///system uri   # must print qemu:///system
ip link show br0       # must exist
```

If any check fails, see the troubleshooting table at the bottom.

## Run it

```bash
cd vm-host
export FCOS_SSH_PUBLIC_KEY='ssh-ed25519 AAAA...'   # your SSH pubkey
export FCOS_CORE_PASSWORD_HASH="$6$..."           # openssl passwd -6
run0 make deploy
```

That's it. `make deploy` renders the Ignition config and provisions the VM
(downloads the FCOS image, verifies it, creates the disk, and boots it).
First boot installs packages and reboots once automatically — this takes
several minutes.

Then:

```bash
make ssh        # log into the VM
make logs       # watch setup progress / get the Kasm admin password
```

Done. Open the workspace URLs above in your browser.

## Everyday commands

| Command | What it does |
|---|---|
| `make status` | Is the VM running? |
| `make ssh` | Log into the VM |
| `make console` | Boot/console output |
| `make logs` | Setup logs (contains Kasm admin password) |
| `make clean` | Delete the VM and its disk (image kept, `make deploy` rebuilds) |

## Troubleshooting

| Problem | Fix |
|---|---|
| `must run as root` | Prefix `run0` (Secureblue) |
| `bridge br0 missing` | Create the bridge: `../diskless-os/init-learnings/setup-br0.sh` |
| SSH never comes up | Wrong guest NIC name. Re-render with `FCOS_INTERFACE=ens2` and redo `make clean && run0 make deploy` |
| Fresh VM wanted | `make clean`, then `run0 make deploy` |
| Render breaks | `butane` missing; install it or set `BUTANE=/path/to/butane` |

## Customizing

Everything is set with environment variables before `make deploy`:

```bash
FCOS_LAN_IP=10.1.29.201   # guest IP        FCOS_GATEWAY=10.1.29.2
VM_NAME=fcos-kasm          # domain name     VM_DISK_GB=75
VM_RAM_MB=4096             # memory          VM_VCPUS=2
```

To change what the VM installs (e.g. drop Suricata), edit
`2_systemd_level/security-setup.service` and `config.bu`, then re-run
`make clean && run0 make deploy`.
