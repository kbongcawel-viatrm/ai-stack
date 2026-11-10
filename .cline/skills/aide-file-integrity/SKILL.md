---
name: aide-file-integrity
description: Configure AIDE file integrity monitoring, establish trusted baselines, validate checks, and investigate filesystem changes on Linux.
---

# AIDE file-integrity monitoring

## Objective and safety
AIDE detects filesystem changes relative to a database; it does not prove a change is malicious. Treat baseline creation and updates as security-sensitive approvals. Preserve existing databases and reports before replacing a baseline.

## Discover current state
- Read the shared [upstream source registry](../../sources/github-repositories.md) and the AIDE manual matching the installed version.
- Inspect package, paths, service/timer setup, config, and database paths before assuming defaults: `rpm -q aide`, `aide --version`, `systemctl list-timers --all | grep -i aide`, and inspect database settings in `/etc/aide.conf`.
- Review `man aide` and `man aide.conf`; flags and database naming vary by release/distribution.

## Configuration workflow
1. Back up `/etc/aide.conf` and any current database to a protected location.
2. Review selection rules and attributes. Consider system binaries, libraries, boot configuration, identity/authentication configuration, and audit/security configuration. Exclude volatile paths, caches, runtime files, and high-churn application data where appropriate.
3. Avoid broad rules that create excessive noise or scan cost. Check rule ordering, exclusions, symlinks, mount boundaries, and immutable/OSTree deployments.
4. Validate config using options supported by the installed version; `aide --config-check` or `aide -D` may be available. Confirm with `aide --help` and local man pages.
5. Initialize a baseline only after verifying the host is known-good. Common command: `run0 aide --init`. Verify the actual output path before promoting it.
6. Protect the trusted database separately from the monitored host (offline or access-controlled remote copy, integrity-protected).
7. Run a check using the locally supported command, commonly `run0 aide --check`. Review each change and correlate it with package updates and deployments.
8. Update the baseline only after every difference is understood and authorized. Do not automatically accept all changes.

## Fedora Secureblue / Atomic considerations
- Do not remount or modify the immutable deployment to work around path differences.
- Package layering may require `rpm-ostree install aide` and a reboot; first check if AIDE is already present and whether the package is available in configured repositories.
- Distinguish changes in the active deployment from persistent writable state. Validate exact monitored paths.
- Secureblue commonly uses `run0`; do not assume `sudo` exists.

## Investigation and reporting
- Record check time, config version/hash, database identity, command, and exit status.
- Separate expected package/config changes from unexplained changes; preserve relevant file metadata and hashes.
- Avoid keeping the only trusted database in the same root-writable environment as the monitored files.

## Official references
- [AIDE Manual](https://aide.github.io/doc/)
- [AIDE configuration manual](https://aide.github.io/doc/aide.conf.5.html)
- [AIDE upstream repository](https://github.com/aide/aide)
- Check installed `aide(1)` and `aide.conf(5)` manuals for version-specific syntax.
