# Session handoff: FCOS Secureblue host verification → br0 done, host-prep playbook added

- Updated: 2026-11-09 21:40 +0800
- **Update 2026-11-10:** LAN renumbered to `192.168.1.0/24` (gw/DNS `192.168.1.1`); `10.1.29.x` is dead. `br0` profile now holds `192.168.1.100/24` (secondary `10.1.29.100/24` removed). `fcos-kasm-poc` VM is running on the hypervisor. Repo defaults (workflows, playbooks, docs) already reflect `192.168.1.x`. Remaining `10.1.29` references below are historical.
- Linear issue: not created yet
- Branch / commit: main / see `git log` for the commit containing this handoff
- Status: in progress — `br0` verified on the hypervisor; ready for `deploy-host-vm` dispatch pending become-path confirmation

## Objective
Deploy the FCOS Host VM on the Fedora Secureblue hypervisor via the GitHub `deploy-host-vm` workflow. Host virtualization prerequisites and the `br0` bridge are now complete; remaining work is Ansible become escalation for Secureblue and workflow dispatch.

## Completed
- Post-reboot verification: `kim` in `libvirt` group; `virsh -c qemu:///system list --all` works (no domains); `virtqemud.service` active; `/dev/kvm` present; `qemu-img` 11.1.3.
- `br0` created and verified via `diskless-os/init-learnings/setup-br0.sh` (~21:21): `br0 UP 10.1.29.100/24` manual, gw/DNS `10.1.29.2`, STP off, IPv6 disabled; `enp1s0` enslaved via `enp1s0-slave`; `wired-dhcp` deactivated with autoconnect disabled; gateway + internet reachable.
- Gateway corrected to `10.1.29.2` across workflows (`deploy-host-vm.yml`, `orchestrate-deployment.yml`, `validate.yml`) and docs (`diskless-os/README.md`, `ansible/README.md`, `butane/README.md`, `services/README.md`, `docs/orchestrated-deployment.md`). `10.1.29.1` does not respond on this LAN.
- New `diskless-os/ansible/playbooks/prepare-hypervisor.yml`: verifies virsh/qemu-img/`/dev/kvm`/libvirt dirs/daemons; on NetworkManager hosts (secureblue/arch/ubuntu) manages the bridge idempotently with ~20s verify retries and automatic rollback. Alpine requires a pre-existing bridge.
- `deploy-host-vm.yml`: new inputs `prepare_host` (bool, default false), `host_bridge_address` (`10.1.29.100/24`), `host_bridge_slave` (`enp1s0`), `host_bridge_dns`; optional prepare step runs before deploy; syntax-check covers both playbooks.
- `orchestrate-deployment.yml`: new `prepare_host` input passed through to `deploy-host-vm`.
- `ansible/README.md` updated with the new playbook, host-prep note, and syntax-check command.

## Current state
- Hypervisor network: only `enp1s0` connected, enslaved to `br0`; `br0` holds `10.1.29.100/24`; default route `via 10.1.29.2 dev br0`.
- Second NIC `enp0s20f0u10` intentionally unplugged; `wired-dhcp-2` profile remains but inactive.
- `/var/lib/libvirt` on btrfs `/var`; `/var/lib/libvirt/images` still absent until the become-enabled deploy/prepare playbook creates it.
- Working tree has many uncommitted changes (this work + earlier pipeline changes + untracked workflows/docs).

## Decisions
- Keep PXE/Host OS items untouched; continue targeting the Secureblue hypervisor for the Host VM stage.
- `enp0s20f0u10` stays unplugged to avoid duplicate `10.1.29.0/24` addressing.
- Bridge cutover is an explicit opt-in (`prepare_host`) because it drops connectivity briefly; the playbook rolls back automatically on verification failure.
- Secureblue privilege escalation RESOLVED: runner == hypervisor, so workflows set `ansible_connection=local` when `HYPERVISOR_HOST` is localhost/127.0.0.1/::1 (no SSH needed). Become uses `community.general.run0` (collection installed in workflow venv) — verified working as `kim` with no prompts via polkit. No `ansible-deploy` user or polkit rule needed; `sudo` does not exist on Secureblue.

## Validation
- `python3 yaml.safe_load` on `deploy-host-vm.yml`, `orchestrate-deployment.yml`, `validate.yml`, `prepare-hypervisor.yml`: OK
- Embedded python heredoc in `deploy-host-vm.yml` compiles: OK
- `setup-br0.sh` run on host: SUCCESS — `br0 UP 10.1.29.100/24`, `default via 10.1.29.2 dev br0`, gw + 8.8.8.8 ping OK
- `ansible-playbook` (ansible-core 2.22 + community.general 14.0.0 in throwaway venv): `prepare-hypervisor.yml` ran against localhost — 20 ok / 5 changed / 0 failed; `br0` verified UP `10.1.29.100/24`, gw `10.1.29.2` reachable after run. Test venv cleaned up.
- Not run: `deploy-fcos-vm.yml` (actual VM provisioning), `virsh dominfo` for `fcos-kasm-poc` (no domain yet)

## Next actions
1. ~~Become path~~ — done: local connection + `community.general.run0` verified on host (prepare-hypervisor.yml ran clean, 20 ok / 5 changed, host healthy after).
2. Commit the working tree changes (workflows, playbook, docs, session notes) — repo is 300+ commits behind `origin/main`; decide on pull/rebase strategy first.
3. Confirm GitHub vars: `HOST_OS=secureblue`, `KASM_POC_FCOS_IP=10.1.29.201`, `FCOS_INTERFACE=enp1s0`, `FCOS_NETWORK_BRIDGE=br0`, `FCOS_GATEWAY=10.1.29.2`, and set `HYPERVISOR_HOST=localhost` (or 127.0.0.1) to activate local connection. SSH secrets still required by validation but unused in local mode.
4. Dispatch `deploy-host-vm` workflow with `host_os=secureblue`, `prepare_host=false` (br0 already exists), correct `fcos_lan_ip`/storage inputs.
5. After VM SSH is reachable, continue with `layer-fcos-packages` → `configure-security` → health check per `orchestrated-deployment.md`.

## Risks / blockers
- Become via run0 verified only from kim's interactive-ish session context; if the GH runner runs as a different user, polkit may deny — test with the actual runner user before dispatch.
- Repo is far behind `origin/main` with a dirty tree; committing/pushing needs a deliberate sync decision.
- `/var/lib/libvirt/images` absent until playbook run; deploy playbook creates it with become.
- `wired-dhcp-2` profile could re-add `10.1.29.200/24` if the second NIC is plugged back in — revisit then.

## Sensitive-data check
- [x] No credentials, raw transcripts, or sensitive payloads in this handoff.
