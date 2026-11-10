---
name: auditd-linux-audit
description: Configure and troubleshoot Linux Audit, review audit rules, and investigate audit events.
---

# Linux Audit and auditd

## Workflow
1. Read the shared source registry and version-matched Linux Audit documentation.
2. Inspect current state before editing: `auditctl -s`, `auditctl -l`, `systemctl status auditd`, and `rpm -q audit`.
3. Review `/etc/audit/auditd.conf`, `/etc/audit/rules.d/`, `/etc/audit/audit.rules`, and `/var/log/audit/audit.log` where present.
4. Back up existing rules and daemon config. Add narrow, purpose-driven rules; consider event volume, disk space, privacy, and performance.
5. Review sample rules before using them. Do not combine all sample rule files blindly or add immutable `-e 2` until the full ruleset has been tested.
6. Load rules using the installed Fedora tooling (often `augenrules --load`), then check `auditctl -s` and `auditctl -l`. Confirm expected events with a safe test.
7. Query with `ausearch` and summarize with `aureport`; preserve relevant records and timestamps for investigations.

## Useful commands
- `auditctl -s` — audit subsystem status and lost-event counters.
- `auditctl -l` — active rules.
- `ausearch --start today -i` — events from today, interpreted.
- `ausearch -k <key> -i` — events matching a rule key.
- `aureport --auth` — authentication report.
- `journalctl -u auditd -b --no-pager` — service logs.

## Secureblue notes
Secureblue is image-based and commonly uses `run0` instead of `sudo`. Confirm the local privilege tool and installed command options. Do not edit immutable `/usr`; use supported writable configuration paths. Check whether `audit=1` is present before proposing kernel argument changes. Avoid disabling audit collection or excluding users without explicit justification and approval.

## Official references
- [Linux Audit userspace source and sample rules](https://github.com/linux-audit/audit-userspace)
- [auditd(8)](https://man7.org/linux/man-pages/man8/auditd.8.html)
- [auditctl(8)](https://man7.org/linux/man-pages/man8/auditctl.8.html)
- [audit.rules(7)](https://man7.org/linux/man-pages/man7/audit.rules.7.html)
- Shared registry: [upstream GitHub sources](../../sources/github-repositories.md)
