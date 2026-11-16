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
- Do not infer that an installed `bootc` binary means the active Secureblue deployment is bootc-managed. Check `bootc status` with appropriate privilege and compare it with `rpm-ostree status` before choosing a management workflow.
- Distinguish an OCI image build artifact from an exported installed deployment. bootc documents building derived images and installing a system from an image; that does not by itself promise a direct snapshot/export of local client-side state.
- The `composefs-rs/examples` patterns (`uki`, `bls`, `unified`, `unified-secureboot`) are build-time ways to produce/test verified OS images. They differ in digest generation/embedding and boot arrangement; they are not documented exports of a running, client-layered Secureblue deployment.

## Useful commands
- `rpm-ostree status` — active/staged deployments and layered packages.
- `bootc status` — bootc view of image-based system state; invoke with the privilege required by the installed version.
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
6. For bootable OCI recovery, identify whether the source is an OSTree commit, a bootc image build, or a registry-delivered native container. Verify image signature/provenance separately from archive readability. A local import test does not prove a fresh host can fetch or trust the image.
7. Treat `/etc` and `/var` as distinct recovery concerns: `/etc` is machine-local configuration with OSTree three-way merge behavior, while mutable application/user data should be backed up independently. Do not claim an OCI base image is a full machine backup.
8. Before using bootc on an rpm-ostree system, read the bootc/rpm-ostree relationship guidance. Client-side package layering can be incompatible with subsequent `bootc upgrade`; do not migrate or rebase a working host as an experiment.
9. Treat composefs/UKI sealing as an image-build and boot-integrity design. It does not itself create a backup of mutable `/etc`, `/var`, home data, or the source host's deployment history. Validate the resulting image on a disposable target with the expected Secure Boot keys and fs-verity-capable filesystem.

## Official references
- [Secureblue docs](https://secureblue.dev/)
- [FAQ and commands](https://secureblue.dev/faq)
- [Features and hardening](https://secureblue.dev/features)
- [Post-install and audit commands](https://secureblue.dev/post-install)
- [Kernel arguments](https://secureblue.dev/articles/kargs)
- [Secureblue upstream](https://github.com/secureblue/secureblue)
- [rpm-ostree docs](https://coreos.github.io/rpm-ostree/)
- [bootc official guide](https://bootc.dev/bootc/)
- [bootc image building](https://bootc.dev/bootc/building/bootc-building-images.7.html)
- [bootc installation](https://bootc.dev/bootc/bootc-installation.7.html)
- [bootc and rpm-ostree relationship](https://bootc.dev/bootc/bootc-relationships.7.html)
- [bootc security and image trust](https://bootc.dev/bootc/bootc-security.7.html)
- [composefs-rs verified OS image examples](https://github.com/composefs/composefs-rs/tree/main/examples)
- Shared registry: [upstream GitHub sources](../../sources/github-repositories.md)
