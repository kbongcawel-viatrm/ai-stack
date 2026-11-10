#!/usr/bin/env bash
# provision-aide — first-boot AIDE environment check for the FCOS guest.
# Installed to /usr/local/sbin/provision-aide by the aide Butane fragment and
# run once by aide-provision.service after the package layer.
# This script deliberately does NOT initialize a baseline: per policy, the
# trusted AIDE database is created manually, reviewed, and only then is the
# daily timer enabled.
set -Eeuo pipefail

install -d -m 0750 /var/log/aide
install -d -m 0755 /var/lib/aide

command -v aide >/dev/null
[[ -r /etc/aide.conf ]] || {
    echo "provision-aide: /etc/aide.conf missing" >&2
    exit 1
}

if [[ -s /var/lib/aide/aide.db.gz ]]; then
    echo "provision-aide: baseline database present"
else
    echo "provision-aide: no baseline yet; initialize manually before enabling aide-check.timer" >&2
fi

echo "provision-aide: environment verified"
