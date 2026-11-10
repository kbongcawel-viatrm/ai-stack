#!/usr/bin/env bash
# provision-ssh — first-boot sshd validation for the FCOS guest.
# Installed to /usr/local/sbin/provision-ssh by the ssh Butane fragment and
# run once by ssh-provision.service after sshd.service starts.
set -Eeuo pipefail

/usr/sbin/sshd -t

if systemctl is-active --quiet sshd.service; then
    systemctl reload sshd.service || systemctl restart sshd.service
fi

echo "provision-ssh: sshd configuration validated"
