---
name: aide-file-integrity
description: Configure AIDE integrity monitoring and investigate filesystem changes on Linux.
---

# AIDE file integrity

- Read `.agents/skills/aide-file-integrity/SKILL.md` as the canonical playbook and consult the shared source registry.
- Inspect `rpm -q aide`, `aide --version`, `man aide`, `man aide.conf`, and `/etc/aide.conf` before assuming paths or options.
- Back up configuration and existing databases. Validate rules and path exclusions before scanning.
- Initialize a baseline only on a known-good host. Verify actual output path, then protect a copy offline or remotely with integrity controls.
- Run `run0 aide --check` only if supported by the installed version. Review every difference and correlate with authorized package/config changes; never automatically accept all changes.
- Secureblue is image-based and commonly uses `run0`, not `sudo`. Do not modify immutable `/usr`; check exact monitored paths and deployment behavior.

## Official references
- [AIDE Manual](https://aide.github.io/doc/)
- [AIDE configuration manual](https://aide.github.io/doc/aide.conf.5.html)
- [AIDE upstream](https://github.com/aide/aide)
