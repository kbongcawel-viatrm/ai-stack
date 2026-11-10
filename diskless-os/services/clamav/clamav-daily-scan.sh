#!/usr/bin/env bash
# clamav-daily-scan — read-only filesystem scan run by clamav-scan.service
# (daily timer). Installed to /usr/local/sbin/clamav-daily-scan by the clamav
# Butane fragment.
set -Eeuo pipefail
install -d -m 0750 /var/log/clamav
log="/var/log/clamav/scan-$(date +%F).log"
echo "[$(date --iso-8601=seconds)] Starting read-only ClamAV scan" | tee -a "$log"
# No --remove or --move: detection is logged, never auto-deleted/quarantined.
clamscan --recursive --infected --log="$log" \
  --exclude-dir='^/proc(/|$)' \
  --exclude-dir='^/sys(/|$)' \
  --exclude-dir='^/dev(/|$)' \
  --exclude-dir='^/run(/|$)' \
  --exclude-dir='^/var/lib/containers(/|$)' \
  --exclude-dir='^/var/home/[^/]+/\.local/share/containers(/|$)' \
  /etc /usr /opt /var/home
