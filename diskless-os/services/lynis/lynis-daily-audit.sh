#!/usr/bin/env bash
# lynis-daily-audit — daily Lynis audit run by lynis-audit.service (timer).
# Installed to /usr/local/sbin/lynis-daily-audit by the lynis Butane fragment.
set -Eeuo pipefail
install -d -m 0750 /var/log/lynis
log="/var/log/lynis/lynis-$(date +%F).log"
report="/var/log/lynis/report-$(date +%F).dat"
lynis audit system --cronjob --quiet --no-colors \
  --log-file "$log" --report-file "$report"
