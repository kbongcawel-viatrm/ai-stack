# session#001 - fcos-deployment-pipeline

## 0. Date

2026-11-09

- **Linear issue:** not created yet
- **Status:** in progress; host BIOS virtualization enabled, libvirt daemons enabled, `virsh` access verified as `kim`; `br0` bridge still pending on the Secureblue hypervisor
- **Memory source:** Linear is the authoritative record for session progress, decisions, blockers, and handoffs. This file is a concise Git-linked snapshot.

## 1. Summary

Fixed and extended the orchestrated FCOS deployment pipeline (`.github/workflows/orchestrate-deployment.yml` and its reusable workflows) so the Host VM stage can run standalone on an existing Fedora Secureblue hypervisor. Resolved a `FileNotFoundError` on the Butane template, aligned `HYPERVISOR_HOST`/`HYPERVISOR_USER` to secrets, made the FCOS QCOW2 image resolvable dynamically from the official stream metadata or pinnable via `https://`/`smb://`/`ftp://`/`ftps://`, and renumbered the LAN to `10.1.29.0/24`.

## 2. Plan

- Debug `orchestrate-deployment.yml` → `deploy-host-vm.yml` failure: `FileNotFoundError: /var/home/kim/actions-runner/_work/_temp/fcos.bu`
- Review all reusable workflows for input/secret/var consistency
- Support deploying directly onto Secureblue (skip Host OS artifacts stage)
- Fetch FCOS QCOW2 URL+SHA256 from official Fedora CoreOS stream metadata at deploy time
- Renumber LAN defaults to `10.1.29.0/24`, guest `10.1.29.201`, gateway `10.1.29.1`
- Support NAS-hosted image over SMB/FTP/FTPS using `NAS_USER`/`NAS_PW` secrets

## 3. Changes

- `.github/workflows/deploy-host-vm.yml`: stage `diskless-os/butane/fcos.bu` into `$RUNNER_TEMP` before Ignition render; `fcos_qcow2_url`/`fcos_qcow2_sha256` now optional (auto-resolve latest stable `qemu` `qcow2.xz` from `builds.coreos.fedoraproject.org/streams/stable.json`); URL validation accepts `https|smb|ftp|ftps`; passes `fcos_qcow2_uncompressed_sha256`, `fcos_qcow2_compressed`, `fcos_qcow2_smb_username/password` to Ansible.
- `.github/workflows/health-check.yml`: `HYPERVISOR_HOST`/`HYPERVISOR_USER` switched from `vars.*` to `secrets.*`.
- `.github/workflows/orchestrate-deployment.yml`: LAN defaults `10.1.29.0/24`/`10.1.29.1`; `vm_storage_path` defaults to `/var/lib/libvirt/images` for non-Alpine `HOST_OS`.
- `.github/workflows/validate.yml`: validation envsubst values updated to `10.1.29.x`.
- `diskless-os/ansible/playbooks/deploy-fcos-vm.yml`: `fcos_lan_ip` default `10.1.29.201`; xz decompressor ensure/install per host OS; `.xz` download → `unxz` → uncompressed sha256 verify; `smb://`/`ftp://`/`ftps://` download via `smbclient`/`curl` with root-only credential files (`no_log`), sha256 verify, credential cleanup.
- Docs/examples updated: `diskless-os/README.md`, `ansible/README.md`, `butane/README.md`, `services/README.md`, `services/firewalld/README.md`, `docs/{architecture,deployment-plan,orchestrated-deployment}.md`, `ansible/inventory/{hosts,health}.yml.example`.
- Commits: `5410ea3` (unsigned, superseded), `0d3a96d` (signed equivalent), `3e9168a` dynamic image + LAN renumbering, `e95cb28`/`7998dea` guest IP `.100`→`.201` correction (`.100` is the host NIC), `7ed7e05` NAS smb/ftp/ftps support.

## 4. Validation steps

- `python3 -c yaml.safe_load` on edited workflows/playbook: OK
- `ansible-playbook --syntax-check playbooks/deploy-fcos-vm.yml`: OK
- Python stream-resolution snippet run locally: resolves build `44.20261023.3.1`, `qcow2.xz` URL + sha256 + uncompressed-sha256 verified
- Host read-only verification on Secureblue (2026-11-09): `id -nG` includes `libvirt`; `virsh -c qemu:///system list --all` succeeds with no domains; `virtqemud.service` active/running; `/dev/kvm` present; `qemu-img` 11.1.3; gateway `10.1.29.1` ping OK
- GitHub `validate` workflow expected to run on push (paths cover `.github/workflows/**`, `diskless-os/**`)
- Not yet run: actual `deploy-host-vm` job against the hypervisor

## 5. Commands

```text
git log --oneline -8
ansible-playbook -i localhost, --syntax-check playbooks/deploy-fcos-vm.yml   # in diskless-os/ansible
# Host-side prerequisites before dispatch:
ls -l /dev/kvm
systemctl status virtqemud libvirtd --no-pager
ip link show br0
# Host progress so far (Fedora Secureblue hypervisor):
#   - Intel VT-x enabled in BIOS; /dev/kvm present, kvm_intel loaded, vmx flag set
#   - qemu-kvm 11.1.3, libvirt 12.6.0, edk2-ovmf, virt-manager installed
#   - `run0 ujust set-libvirt-daemons on` enabled+started virtqemud,
#     virtinterfaced, virtnetworkd, virtnodedevd, virtnwfilterd, virtsecretd,
#     virtstoraged, virtlogd, virtlockd, virtproxyd (non-root run fails with
#     "Access denied" on systemd start)
#   - kim is in `libvirt` group; `virsh -c qemu:///system list --all` works
#     as kim and currently lists no domains
#   - br0 NOT yet created. Active NM connections: `wired-dhcp` on enp1s0
#     10.1.29.100/24 and `wired-dhcp-2` on enp0s20f0u10 10.1.29.200/24,
#     both manual with gateway/DNS via 10.1.29.1; gateway ping OK
#   - /var/lib/libvirt exists on btrfs /var; /var/lib/libvirt/images is
#     absent until the become-enabled deploy playbook creates it
```

## 6. Session and commit

- `session#001 | main` (host-verification update committed before reboot; see `git log` for SHA)

## Next steps / blockers

- ~~Host reboot pending: enable Intel VT-x (+ VT-d optional) in BIOS~~ — done 2026-11-09; `/dev/kvm` verified, `kvm_intel` loaded.
- Create `br0` on Secureblue (NetworkManager): bridge `br0` with host IP `10.1.29.100/24`, slave `enp1s0`, gateway/DNS from `nmcli -g ipv4.gateway,ipv4.dns con show "wired-dhcp"`. Example:
  `nmcli con add type bridge con-name br0 ifname br0` → `nmcli con mod br0 ipv4.method manual ipv4.addresses 10.1.29.100/24 ipv4.gateway <GW> ipv4.dns "<DNS>"` → `nmcli con add type bridge-slave con-name enp1s0-slave ifname enp1s0 master br0` → `nmcli con down "wired-dhcp"; nmcli con up br0`. Brief connectivity drop expected; use local console if SSH.
- Re-verify after reboot and after `br0` creation: `virsh -c qemu:///system list --all` as `kim`, `virtqemud` active, `ip -br addr show br0` shows `10.1.29.100/24`, gateway reachable.
- Then confirm GitHub repo variables: `HOST_OS=secureblue`, `KASM_POC_FCOS_IP=10.1.29.201`, `FCOS_INTERFACE=enp1s0`, `FCOS_NETWORK_BRIDGE=br0` (last two optional — already defaults).
- Secrets: `NAS_USER`/`NAS_PW` if using NAS image; per-environment secrets per `orchestrated-deployment.md`.
- `FCOS_QCOW2_URL`/`FCOS_QCOW2_SHA256` optional — set together only to pin (e.g. `ftps://10.1.29.1:21/...` or `smb://10.1.29.1/<share>/images/fcos-qcow.xz`); verify share name in URL (`smb://host/share/path`).
- `suricata_test_target_ip` required when running `run_provision_services`.
- Host OS / PXE items intentionally untouched (`192.168.1.2` PXE server defaults remain).
