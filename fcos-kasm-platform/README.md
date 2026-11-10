# fcos-kasm-platform

Provision a hardened Fedora CoreOS VM on the hypervisor and run Kasm
workspace containers on it. Fully modular: each concern is a Butane fragment,
merged into one Ignition config.

## Run it

On the hypervisor host:

```bash
cd fcos-kasm-platform

# one-time
ansible-galaxy collection install -r requirements.yml
# set fcos_coreos_build in roles/qemu_provisioner/defaults/main.yml
# make sure br0 has a carrier:  bridge link

# credentials (not committed)
export FCOS_SSH_PUBLIC_KEY="$(cat ~/.ssh/core.pub)"
export FCOS_CORE_PASSWORD_HASH="$(openssl passwd -6)"

# everything
./build.sh all
```

Or step by step:

```bash
./build.sh render       # build/config.ign
./build.sh provision    # VM disk + boot
./build.sh configure    # post-boot setup
```

When it finishes, open `https://192.168.1.201` on ports `6901` (Ubuntu
desktop), `3101` (LibreWolf), `3201` (Arch Linux). The VNC password is in
`/var/opt/kasm/.env` on the guest.

## Change what gets installed

Edit `group_vars/all.yml` — flip `enable_*` toggles (firewalld, suricata,
clamav, aide, lynis, kasm, home_security) or `use_static_ip`. Re-run
`./build.sh all`. For a fresh VM, delete
`/var/lib/libvirt/images/fcos-kasm-poc/` first.

## What's inside

- `butane_modules/` — one `.bu.j2` per concern (base, rpm-ostree, firewalld,
  suricata, clamav, aide, lynis, kasm) + payload files
- `roles/` — `butane_composer` (render/merge), `qemu_provisioner` (VM),
  `kasm_configurator` (post-boot)
- `site.yml` + `build.sh`/`Makefile` — the entry points
- `profiles/` — preset toggle combos (`full-dhcp`, `full-static`, `kasm-only`)
