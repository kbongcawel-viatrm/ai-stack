#!/usr/bin/env bash
# clamav-init.sh — post-layering ClamAV bring-up (freshclam DB + daily timer).
# Runs once per boot after rpm-ostree packages exist; every step idempotent.
set -uo pipefail

STAMP=/var/lib/rpm-ostree-install.stamp
[[ -f "$STAMP" ]] || exit 0

install -d -m 0750 /var/lib/clamav
chown -R clamav:clamav /var/lib/clamav 2>/dev/null || true

# Prime the signature database once so the first timer run isn't a cold start.
if [[ ! -f /var/lib/clamav/main.cvd && ! -f /var/lib/clamav/daily.cvd ]]; then
  freshclam --quiet --config=/etc/clamav/freshclam.conf || true
fi

systemctl enable --now clamav-daily.timer || true
exit 0
