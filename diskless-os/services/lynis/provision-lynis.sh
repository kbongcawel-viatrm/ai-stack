#!/usr/bin/env bash
# provision-lynis — first-boot Lynis environment check for the FCOS guest.
# Installed to /usr/local/sbin/provision-lynis by the lynis Butane fragment
# and run once by lynis-provision.service after the package layer.
set -Eeuo pipefail

install -d -m 0750 /var/log/lynis
install -d -m 0755 /var/lib/lynis

command -v lynis >/dev/null

echo "provision-lynis: environment verified"
