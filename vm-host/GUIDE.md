# vm-host — Usage Guide

End-to-end: prepare the hypervisor → build the Ignition config → deploy the
VM → use the Kasm workspaces. Run everything directly on the host OS; no
GitHub Actions, no Ansible.

## Step 0 — Prerequisites (host, once)

On the hypervisor (Fedora Secureblue or similar):

1. **CPU virtualization** — enable VT-x in BIOS; verify:
   ```bash
   ls -l /dev/kvm                 # must exist
   ```
2. **libvirt + tools**
   ```bash
   run0 ujust set-libvirt-daemons on   # Secureblue; plain distros: enable libvirtd
   virsh -c qemu:///system uri         # should print qemu:///system
   qemu-img --version && virt-install --version
   ```
   Also needed: `butane`, `python3`, `curl`, `xz` (all in default repos, or
   butane from the upstream release tarball into `~/.local/bin`).
3. **LAN bridge `br0`** — the guest attaches to it:
   ```bash
   ip link show br0 || echo "create br0 first (see diskless-os/init-learnings/setup-br0.sh)"
   ```

## Step 1 — Build the Ignition config (renders `vm-host.ign`)

```bash
cd vm-host
export FCOS_SSH_PUBLIC_KEY='ssh-ed25519 AAAA...'          # your pubkey
export FCOS_CORE_PASSWORD_HASH='$6$...'                   # openssl passwd -6
# optional overrides (defaults shown):
#   FCOS_INTERFACE=ens2  FCOS_LAN_IP=10.1.29.201
#   FCOS_GATEWAY=10.1.29.2  FCOS_LAN_CIDR=10.1.29.0/24
./build.sh          # → vm-host.ign
```

## Step 2 — Deploy the VM

```bash
run0 make deploy    # Secureblue (asks for authorization via polkit)
# or on non-Secureblue hosts:
make deploy
```

What it does (idempotent, safe to re-run):

1. Verifies tools, `/dev/kvm`, `br0`, and that the Ignition file exists.
2. Downloads the latest **Fedora CoreOS stable** qcow2, verifies its sha256
   (pin a specific image with `FCOS_QCOW2_URL` + `FCOS_QCOW2_SHA256`), and
   decompresses it to `/var/lib/libvirt/images/base/fcos-base.qcow2`.
3. Creates the writable overlay `/var/lib/libvirt/images/<VM_NAME>.qcow2`
   (default `VM_NAME=fcos-kasm`, 75 GB; tune with `VM_DISK_GB`, `VM_RAM_MB`,
   `VM_VCPUS`).
4. Defines + starts the libvirt domain with the Ignition config injected via
   `fw_cfg` (**first boot only** — later boots use the persistent overlay).
5. Waits up to 15 min for SSH at `FCOS_LAN_IP`.

Re-running skips the verified download and existing overlay; set
`RECREATE_OVERLAY=1` to start from a fresh disk. It never touches an
existing domain.

## Step 3 — Watch first boot (two boots, fully automatic)

```bash
make console   # serial console; Ctrl-] to detach
make logs      # or from the guest: ssh core@10.1.29.201
```

- **Boot 1** — `security-setup.service` layers packages (firewalld,
  suricata, clamav, aide, lynis, moby-engine, docker-compose), writes a
  stamp, and reboots once.
- **Boot 2** — `security-finalize.service` applies the firewall zone,
  fetches Suricata ET rules, sets up ClamAV/AIDE, then
  `kasm-workspace.service` pulls the workspace containers and brings the
  stack up.

## Step 4 — Use it

| What | How |
|---|---|
| SSH into the VM | `make ssh` (`core@10.1.29.201`) |
| Ubuntu desktop | `https://10.1.29.201:6901` |
| LibreWolf browser | `https://10.1.29.201:3101` |
| Arch XFCE | `https://10.1.29.201:3201` |
| Kasm admin creds | `make logs` — printed by `kasm-workspace.service` (`admin@kasm.local`) |
| home-security.uk v2 | follow "prerequisites (manual, once)" in README.md, then restart `home-security.service` |

## Everyday operations

```bash
make status     # domain info + list
make console    # serial console
make ssh        # ssh core@10.1.29.201
make logs       # tail provisioning units
make clean      # remove domain + overlay (base image + Ignition kept)
```

## Troubleshooting

- **`must run as root`** — use `run0 ./deploy.sh` (Secureblue) or `sudo`.
- **`bridge br0 missing`** — create it first (Step 0.3).
- **SSH never comes up** — `make console`; the most common cause is the
  guest NIC name: FCOS expects `ens2` (libvirt PCI slot 0x02). Override
  with `FCOS_INTERFACE` and re-render + `RECREATE_OVERLAY=1`.
- **Want a fresh VM** — `make clean`, then `run0 make deploy`.
- **Stuck mid-first-boot** — layering takes several minutes
  (`security-setup.service`); the reboot is normal.

## Make targets

| Target | Effect |
|---|---|
| `deploy` | `build.sh` + `deploy.sh` (full pipeline) |
| `ignition` | render `vm-host.ign` only |
| `status` / `console` / `ssh` / `logs` | daily operations above |
| `clean` | remove domain + overlay disk |
