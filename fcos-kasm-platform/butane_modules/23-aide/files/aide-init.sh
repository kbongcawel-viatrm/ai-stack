#!/usr/bin/env bash
# aide-init.sh — post-layering AIDE bring-up (baseline DB + daily timer).
# Runs once per boot after rpm-ostree packages exist; every step idempotent.
set -uo pipefail

STAMP=/var/lib/rpm-ostree-install.stamp
[[ -f "$STAMP" ]] || exit 0

install -d -m 0750 /var/lib/aide /var/log/aide

# Build the baseline once. `aide --init` writes aide.db.new; promote it so
# `aide --check` in aide-daily.service has a database to compare against.
if [[ ! -f /var/lib/aide/aide.db ]]; then
  aide --init --config=/etc/aide/aide.conf || true
  if [[ -f /var/lib/aide/aide.db.new && ! -f /var/lib/aide/aide.db ]]; then
    mv -f /var/lib/aide/aide.db.new /var/lib/aide/aide.db
  fi
fi

systemctl enable --now aide-daily.timer || true
exit 0
