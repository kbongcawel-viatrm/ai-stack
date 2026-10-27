---
name: podman-container-management
description: Operate, troubleshoot, secure, and maintain rootless or rootful Podman containers and pods.
---

# Podman container management

## Discovery
Capture Podman version, rootless/rootful mode, storage driver, cgroup version, network backend, host OS, and whether the system is immutable. Inspect `podman info`, `podman ps -a`, `podman pod ps`, and relevant logs before changing state.

## Operating workflow
1. Identify the intended container/pod and its owner (user or root). Do not mix rootless and rootful storage or sockets accidentally.
2. Inspect image digest, entrypoint, command, mounts, ports, networks, health checks, restart policy, resource limits, and recent events.
3. Prefer pinned image tags or digests for production. Review image provenance and scan images before use.
4. Use least privilege: rootless by default, non-root user inside container, read-only root filesystem where compatible, dropped capabilities, no privileged mode, and narrowly scoped mounts.
5. Manage secrets with secret mounts or supported secret providers; do not embed credentials in images, Compose files, labels, or command arguments.
6. Set explicit CPU/memory/PID limits based on measured workload and host capacity. Account for other services and reserve headroom for the OS.
7. Persist only required data in named volumes or carefully scoped bind mounts. Validate SELinux labeling on Fedora; do not disable SELinux to work around mount denials.
8. Use health checks, structured logs, predictable names, and documented backup/restore procedures.
9. For changes, record current settings, apply one change at a time, and verify readiness, logs, connectivity, persistence, and rollback.
10. On immutable Fedora variants, use supported host package and service-management workflows; avoid assuming traditional mutable-host changes persist.

## Troubleshooting order
Check container state and exit code; inspect logs/events; verify image/command/env; verify DNS, routes, port binding and firewall; inspect mounts/SELinux labels; inspect cgroups/resource pressure; then test runtime/storage issues. Do not delete volumes or reset storage before confirming backups and impact.

## Validation
Use `podman inspect`, `podman stats --no-stream`, `podman logs`, `podman events`, and `podman healthcheck run` where supported. Confirm expected behavior as the correct user. Redact secrets from outputs before sharing.


## Upstream sources
- https://github.com/containers/podman
- https://github.com/containers/common
- https://github.com/containers/storage
- https://docs.podman.io/
- Shared index: [GitHub repository sources](../../sources/github-repositories.md). Verify the upstream version against the target deployment before relying on examples.
