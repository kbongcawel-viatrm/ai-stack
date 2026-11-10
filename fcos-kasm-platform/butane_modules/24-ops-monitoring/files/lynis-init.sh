#!/usr/bin/env bash
# lynis-init.sh — post-layering Lynis bring-up (daily audit timer).
# Runs once per boot after rpm-ostree packages exist; every step idempotent.
set -uo pipefail

STAMP=/var/lib/rpm-ostree-install.stamp
[[ -f "$STAMP" ]] || exit 0

install -d -m 0755 /var/log/lynis
systemctl enable --now lynis-daily.timer || true
exit 0
