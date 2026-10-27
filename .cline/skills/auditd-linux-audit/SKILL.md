---
name: auditd-linux-audit
description: Linux Audit daemon configuration and event review.
---

# Linux Audit

Use `.agents/skills/auditd-linux-audit/SKILL.md` as the canonical detailed workflow. Read version-matched upstream documentation before changing audit configuration. Inspect active rules and audit status first, back up config, use narrow purpose-driven rules, validate after loading, and preserve logs during investigations. Secureblue commonly uses `run0`; confirm the local command and do not edit immutable `/usr`.

Official references:
- https://github.com/linux-audit/audit-userspace
- https://man7.org/linux/man-pages/man8/auditd.8.html
- https://man7.org/linux/man-pages/man8/auditctl.8.html
- https://man7.org/linux/man-pages/man7/audit.rules.7.html
