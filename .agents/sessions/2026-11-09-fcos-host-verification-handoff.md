# Session handoff: FCOS Secureblue host verification

- Updated: 2026-11-09 16:33 +0800
- Linear issue: not created yet
- Branch / commit: main / see `git log` for the commit containing this handoff
- Status: in progress

## Objective
Resume the FCOS deployment pipeline work on the Fedora Secureblue hypervisor and confirm host virtualization prerequisites before creating `br0` or dispatching `deploy-host-vm`.

## Completed
- Confirmed `kim` is in the `libvirt` group.
- Confirmed `virsh -c qemu:///system list --all` succeeds as `kim`; no domains are defined.
- Confirmed `virtqemud.service` is active/running, `/dev/kvm` exists, and `qemu-img` is version 11.1.3.
- Recorded the active NetworkManager state and missing `br0` in `docs/sessions/session#001-fcos-deployment-pipeline.md`.

## Current state
- The repository was clean before this save; the session record and this handoff are committed before reboot.
- The hypervisor has working KVM/libvirt access, but `br0` does not exist yet.
- Active links: `enp1s0` has `10.1.29.100/24`; `enp0s20f0u10` has `10.1.29.200/24`; gateway `10.1.29.1` is reachable.
- `/var/lib/libvirt` is on btrfs `/var`; `/var/lib/libvirt/images` is absent until the become-enabled deploy playbook creates it.

## Decisions
- Keep PXE/Host OS items untouched and continue targeting the existing Secureblue hypervisor for the Host VM stage.
- Do not create `br0` during reboot preparation; resume and verify host state after reboot first.

## Validation
- Command: `virsh -c qemu:///system list --all`
- Result: success; empty domain table
- Command: `ip -br addr`; `ip route`; `nmcli con show --active`
- Result: no `br0`; two manual `10.1.29.0/24` connections and duplicate default routes via `10.1.29.1`
- Not run: `deploy-host-vm` workflow, `virsh dominfo`/`domifaddr` for `fcos-security` (domain does not exist yet), `qemu-img info` on the FCOS overlay (not created yet)

## Next actions
1. After reboot, run `bash scripts/resume-session.sh` and re-check `id -nG`, `virsh -c qemu:///system list --all`, `systemctl list-units 'virt*' --type=service --state=running --no-pager`, `ip -br addr`, and `ip route`.
2. If `br0` is still absent, create it on Secureblue with the NetworkManager commands recorded in `docs/sessions/session#001-fcos-deployment-pipeline.md`, preferably from the local console because activation causes a brief connectivity drop.
3. Verify `br0` has `10.1.29.100/24` and the gateway is reachable, then confirm GitHub variables/secrets before dispatching `deploy-host-vm`.

## Risks / blockers
- Blocker: `br0` is missing, so the FCOS VM cannot attach to `br0` until it is created.
- Risk: two active interfaces currently have manual addresses in `10.1.29.0/24` and duplicate default routes via `10.1.29.1`; avoid changing NICs until the bridge plan is confirmed.
- `/var/lib/libvirt/images` is absent locally, but the playbook creates the required directories when run with `become: true`.

## Sensitive-data check
- [x] No credentials, raw transcripts, or sensitive payloads in this handoff.
