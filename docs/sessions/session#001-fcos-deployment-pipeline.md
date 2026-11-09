# session#001 - fcos-deployment-pipeline

## 0. Date

2026-11-09

- **Linear issue:** not created yet
- **Status:** in progress; blocked on host reboot for virtualization enablement
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
```

## 6. Session and commit

- `session#001 | 7ed7e05` (HEAD at time of writing; this doc commit will follow)

## Next steps / blockers

- Host reboot pending: enable Intel VT-x (+ VT-d optional) in BIOS, then verify `/dev/kvm`, start `virtqemud`/`libvirtd`, confirm `br0` exists.
- GitHub repo variables to confirm: `HOST_OS=secureblue`, `KASM_POC_FCOS_IP=10.1.29.201`, `FCOS_INTERFACE=enp1s0`, `FCOS_NETWORK_BRIDGE=br0` (last two optional — already defaults).
- Secrets: `NAS_USER`/`NAS_PW` if using NAS image; per-environment secrets per `orchestrated-deployment.md`.
- `FCOS_QCOW2_URL`/`FCOS_QCOW2_SHA256` optional — set together only to pin (e.g. `ftps://10.1.29.1:21/...` or `smb://10.1.29.1/<share>/images/fcos-qcow.xz`); verify share name in URL (`smb://host/share/path`).
- `suricata_test_target_ip` required when running `run_provision_services`.
- Host OS / PXE items intentionally untouched (`192.168.1.2` PXE server defaults remain).
