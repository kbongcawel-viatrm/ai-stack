#!/usr/bin/env bash
# aide-daily-check — daily AIDE integrity check run by aide-check.service
# (timer, disabled until a baseline is reviewed). Installed to
# /usr/local/sbin/aide-daily-check by the aide Butane fragment.
set -Eeuo pipefail
install -d -m 0750 /var/log/aide
echo "[$(date --iso-8601=seconds)] AIDE integrity check" | tee -a "/var/log/aide/check-$(date +%F).log"
# AIDE baseline creation/replacement is a separate, manual operation.
aide --check 2>&1 | tee -a "/var/log/aide/check-$(date +%F).log"
