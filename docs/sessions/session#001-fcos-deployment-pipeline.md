# session#001 - fcos-deployment-pipeline

## 0. Date

2026-11-09

- **Linear issue:** not created yet
- **Status:** in progress; `br0` verified on the Secureblue hypervisor; `fcos-kasm-poc` VM running. **2026-11-10 update:** LAN renumbered to `192.168.1.0/24` (gw/DNS `192.168.1.1`, host bridge `192.168.1.100/24`, guest `192.168.1.201`); `10.1.29.x` retired — `10.1.29.x` references below are historical.
- **Memory source:** Linear is the authoritative record for session progress, decisions, blockers, and handoffs. This file is a concise Git-linked snapshot.

## 1. Summary

Fixed and extended the orchestrated FCOS deployment pipeline (`.github/workflows/orchestrate-deployment.yml` and its reusable workflows) so the Host VM stage can run standalone on an existing Fedora Secureblue hypervisor. Resolved a `FileNotFoundError` on the Butane template, aligned `HYPERVISOR_HOST`/`HYPERVISOR_USER` to secrets, made the FCOS QCOW2 image resolvable dynamically from the official stream metadata or pinnable via `https://`/`smb://`/`ftp://`/`ftps://`, and renumbered the LAN to `10.1.29.0/24`.

## 2. Plan

- Debug `orchestrate-deployment.yml` → `deploy-host-vm.yml` failure: `FileNotFoundError: /var/home/kim/actions-runner/_work/_temp/fcos.bu`
- Review all reusable workflows for input/secret/var consistency
- Support deploying directly onto Secureblue (skip Host OS artifacts stage)
- Fetch FCOS QCOW2 URL+SHA256 from official Fedora CoreOS stream metadata at deploy time
- Renumber LAN defaults to `10.1.29.0/24`, guest `10.1.29.201`, gateway `10.1.29.2` (actual LAN gateway; `10.1.29.1` does not respond)
- Support NAS-hosted image over SMB/FTP/FTPS using `NAS_USER`/`NAS_PW` secrets

## 3. Changes

- `.github/workflows/deploy-host-vm.yml`: stage `diskless-os/butane/fcos.bu` into `$RUNNER_TEMP` before Ignition render; `fcos_qcow2_url`/`fcos_qcow2_sha256` now optional (auto-resolve latest stable `qemu` `qcow2.xz` from `builds.coreos.fedoraproject.org/streams/stable.json`); URL validation accepts `https|smb|ftp|ftps`; passes `fcos_qcow2_uncompressed_sha256`, `fcos_qcow2_compressed`, `fcos_qcow2_smb_username/password` to Ansible.
- `.github/workflows/health-check.yml`: `HYPERVISOR_HOST`/`HYPERVISOR_USER` switched from `vars.*` to `secrets.*`.
- `.github/workflows/orchestrate-deployment.yml`: LAN defaults `10.1.29.0/24`/`10.1.29.2`; `vm_storage_path` defaults to `/var/lib/libvirt/images` for non-Alpine `HOST_OS`; new `prepare_host` boolean input passed to `deploy-host-vm`.
- `.github/workflows/deploy-host-vm.yml`: gateway defaults corrected to `10.1.29.2`; new inputs `prepare_host`, `host_bridge_address` (`10.1.29.100/24`), `host_bridge_slave` (`enp1s0`), `host_bridge_dns`; optional "Prepare hypervisor host" step runs `prepare-hypervisor.yml` before the VM deploy.
- `diskless-os/ansible/playbooks/prepare-hypervisor.yml` (new): verifies virsh/qemu-img/`/dev/kvm`/libvirt dirs/daemons; on NetworkManager hosts creates/configures the bridge, enslaves the NIC, disables the old connection's autoconnect, cuts over with ~20s verification retries and automatic rollback on failure. Secureblue escalation note: non-root become needs `community.general.run0` + polkit rule, or connect as root.
- `diskless-os/init-learnings/setup-br0.sh`: manual equivalent of the bridge cutover used to create `br0` on the hypervisor (verified working 2026-11-09).
- Docs gateway defaults corrected `10.1.29.1` → `10.1.29.2`: `diskless-os/README.md`, `ansible/README.md`, `butane/README.md`, `services/README.md`, `docs/orchestrated-deployment.md`.
- `.github/workflows/validate.yml`: validation envsubst values updated to `10.1.29.x`.
- `diskless-os/ansible/playbooks/deploy-fcos-vm.yml`: `fcos_lan_ip` default `10.1.29.201`; xz decompressor ensure/install per host OS; `.xz` download → `unxz` → uncompressed sha256 verify; `smb://`/`ftp://`/`ftps://` download via `smbclient`/`curl` with root-only credential files (`no_log`), sha256 verify, credential cleanup.
- Docs/examples updated: `diskless-os/README.md`, `ansible/README.md`, `butane/README.md`, `services/README.md`, `services/firewalld/README.md`, `docs/{architecture,deployment-plan,orchestrated-deployment}.md`, `ansible/inventory/{hosts,health}.yml.example`.
- 2026-11-10 modularization: monolithic `fcos.bu` split into base fragment + per-service fragments `diskless-os/services/<svc>/<svc>.bu` (ssh, firewalld, suricata, clamav, lynis, aide). Payload scripts moved to `services/<svc>/` (`provision-<svc>.sh` oneshots + existing daily/prepare scripts); `diskless-os/butane/compose-bu.py` inlines them via `@@include` markers and generates `root.bu` for `ignition.config.merge`. `deploy-host-vm.yml` and `validate.yml` compose → envsubst → per-fragment `butane --strict` → merged `.ign`. Verified locally with butane 0.23.0: 7 fragments → 28 files / 32 units merged.
- Commits: `5410ea3` (unsigned, superseded), `0d3a96d` (signed equivalent), `3e9168a` dynamic image + LAN renumbering, `e95cb28`/`7998dea` guest IP `.100`→`.201` correction (`.100` is the host NIC), `7ed7e05` NAS smb/ftp/ftps support.

## 4. Validation steps

- `python3 -c yaml.safe_load` on edited workflows/playbook: OK
- `ansible-playbook --syntax-check playbooks/deploy-fcos-vm.yml`: OK
- Python stream-resolution snippet run locally: resolves build `44.20261023.3.1`, `qcow2.xz` URL + sha256 + uncompressed-sha256 verified
- Host verification on Secureblue (2026-11-09, post-reboot): `id -nG` includes `libvirt`; `virsh -c qemu:///system list --all` succeeds with no domains; `virtqemud.service` active; `/dev/kvm` present; `qemu-img` 11.1.3
- `br0` created via `diskless-os/init-learnings/setup-br0.sh`: `br0 UP 10.1.29.100/24`, `enp1s0` enslaved (`enp1s0-slave`), default route `via 10.1.29.2 dev br0`, gateway + internet ping OK, `wired-dhcp` deactivated with autoconnect disabled. First attempt failed on a timing race (verify ran before slave port attached); fixed with retry loop + `bridge.stp no`.
- Second NIC `enp0s20f0u10` intentionally left unplugged; its `wired-dhcp-2` profile remains but inactive.
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
#   - br0 CREATED 2026-11-09 ~21:21 via init-learnings/setup-br0.sh:
#     br0 UP 10.1.29.100/24 (manual, gw/dns 10.1.29.2, stp off, ipv6 off),
#     enp1s0 enslaved via enp1s0-slave; wired-dhcp deactivated + autoconnect no.
#     enp0s20f0u10 unplugged intentionally; wired-dhcp-2 profile remains inactive.
#   - /var/lib/libvirt exists on btrfs /var; /var/lib/libvirt/images is
#     absent until the become-enabled deploy playbook creates it
```

## 6. Session and commit

- `session#001 | main` (host-verification update committed before reboot; see `git log` for SHA)

## Next steps / blockers

- ~~Host reboot pending: enable Intel VT-x (+ VT-d optional) in BIOS~~ — done 2026-11-09; `/dev/kvm` verified, `kvm_intel` loaded.
- ~~Create `br0` on Secureblue~~ — done 2026-11-09; verified `br0 UP 10.1.29.100/24`, gateway `10.1.29.2` reachable. Consolidated into `prepare-hypervisor.yml` + `setup-br0.sh`.
- Confirm Ansible become path for Secureblue before dispatch: non-root `HYPERVISOR_USER` needs `community.general.run0` become plugin + polkit rule, or use `HYPERVISOR_USER=root` (`ansible_become` is already skipped for root in the inventory builder).
- Confirm GitHub repo variables: `HOST_OS=secureblue`, `KASM_POC_FCOS_IP=10.1.29.201`, `FCOS_INTERFACE=enp1s0`, `FCOS_NETWORK_BRIDGE=br0`, `FCOS_GATEWAY=10.1.29.2` (or rely on corrected defaults).
- Secrets: `NAS_USER`/`NAS_PW` if using NAS image; per-environment secrets per `orchestrated-deployment.md`.
- `FCOS_QCOW2_URL`/`FCOS_QCOW2_SHA256` optional — set together only to pin (e.g. `ftps://10.1.29.1:21/...` or `smb://10.1.29.1/<share>/images/fcos-qcow.xz`); verify share name in URL (`smb://host/share/path`).
- `suricata_test_target_ip` required when running `run_provision_services`.
- Host OS / PXE items intentionally untouched (`192.168.1.2` PXE server defaults remain).
