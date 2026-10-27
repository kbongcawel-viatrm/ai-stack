---
name: fedora-secureblue-operations
description: Secureblue operations quick reference.
---

Canonical detailed workflow: `.agents/skills/fedora-secureblue-operations/SKILL.md`.

Read-only checks: `cat /etc/os-release`, `uname -r`, `rpm-ostree status`, `ujust --list`, `systemctl --failed`, `getenforce`.

Secureblue is image-based. Prefer documented update and `ujust` workflows; do not manually edit immutable `/usr`. Confirm commands exist on the installed image. Secureblue commonly uses `run0` rather than `sudo`. Inspect current state and define rollback before host changes.

Official docs: https://secureblue.dev/ ; https://secureblue.dev/faq ; https://secureblue.dev/features ; https://secureblue.dev/post-install ; https://secureblue.dev/articles/kargs ; https://github.com/secureblue/secureblue ; https://coreos.github.io/rpm-ostree/ .
