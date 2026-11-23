---
name: fedora-secureblue-operations
description: Safely operate, audit, troubleshoot, update, and customize Fedora Secureblue and rpm-ostree-based immutable systems.
---

# Fedora Secureblue operations

## Inspect first
Read-only initial checks:
```bash
cat /etc/os-release
uname -r
rpm-ostree status
ujust --list
systemctl --failed
getenforce
```
Some commands vary by Secureblue image/generation; confirm availability before use.

## Operating model
- Secureblue is a Fedora-derived image-based system, not a conventional mutable Fedora installation. Prefer official `ujust` recipes and documented package/update mechanisms.
- Treat `/usr` as deployment-managed; do not edit it manually to make changes persistent.
- Distinguish layered RPMs, Flatpaks, Homebrew, containers, and user configuration. Check whether a package is already installed before layering it.
- Secureblue commonly uses `run0` in place of `sudo`; confirm the available privilege mechanism.
- Read official docs before overriding hardening features or changing kernel arguments, SELinux, user namespaces, ptrace, DNS, USBGuard, Secure Boot, or container trust policy.

## Useful commands
- `rpm-ostree status` — active/staged deployments and layered packages.
- `rpm -qa | grep -i <name>` — check installed RPMs.
- `ujust --list` — discover available helper recipes.
- `ujust audit-secureblue` — run Secureblue's audit recipe if available.
- `ujust update-system` — documented manual update recipe; verify it exists first.
- `systemctl --failed` and `journalctl -b -p warning` — inspect failures.
- `getenforce` — inspect SELinux enforcement state.
- `rpm-ostree kargs` — inspect/manage kernel arguments only after reading the help and Secureblue guidance.
- `podman info`, `podman ps -a`, `podman image ls` — inspect container state.

## Change management
1. Capture current state and staged deployment before any update or configuration change.
2. Read command output and inspect `rpm-ostree status` afterward; staged deployments typically require reboot.
3. Do not combine system updates, boot-argument changes, and unrelated hardening edits in one unreviewed operation.
4. Before service/network changes, preserve config and define rollback. Never disable SELinux, signature enforcement, firewall rules, or kernel hardening as a generic workaround.
5. For rejected container images, inspect policy and provenance; avoid broad trust/accept rules.

## Official references
- [Secureblue docs](https://secureblue.dev/)
- [FAQ and commands](https://secureblue.dev/faq)
- [Features and hardening](https://secureblue.dev/features)
- [Post-install and audit commands](https://secureblue.dev/post-install)
- [Kernel arguments](https://secureblue.dev/articles/kargs)
- [Secureblue upstream](https://github.com/secureblue/secureblue)
- [rpm-ostree docs](https://coreos.github.io/rpm-ostree/)
- Shared registry: [upstream GitHub sources](../../sources/github-repositories.md)
