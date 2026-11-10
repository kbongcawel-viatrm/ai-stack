#!/usr/bin/env bash
# provision-clamav — first-boot ClamAV environment check for the FCOS guest.
# Installed to /usr/local/sbin/provision-clamav by the clamav Butane fragment
# and run once by clamav-provision.service after the package layer.
# Signature freshness is owned by clamav-freshclam-daily.service; this script
# only seeds the database once when it is entirely absent.
set -Eeuo pipefail

install -d -m 0750 /var/log/clamav
install -d -m 0755 /var/lib/clamav

command -v clamscan >/dev/null
command -v freshclam >/dev/null

if [[ ! -s /var/lib/clamav/main.cvd ]]; then
    echo "provision-clamav: no signature database yet; running freshclam once"
    # Non-fatal: the daily freshclam unit retries with backoff. Failure here
    # must not block boot; clamav-scan.service depends on the daily update.
    freshclam --stdout || echo "provision-clamav: initial freshclam failed; will retry via timer" >&2
else
    echo "provision-clamav: signature database present"
fi

echo "provision-clamav: environment verified"
