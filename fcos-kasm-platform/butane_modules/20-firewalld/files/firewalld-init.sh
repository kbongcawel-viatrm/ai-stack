#!/usr/bin/env bash
# firewalld-init.sh — post-layering firewalld bring-up for the FCOS VM host.
# Runs once per boot after rpm-ostree packages exist; every step idempotent.
set -uo pipefail

STAMP=/var/lib/rpm-ostree-install.stamp
[[ -f "$STAMP" ]] || exit 0

# Bind the workspace zone to the primary connected NIC so inbound policy is
# enforced on the guest interface (zone file allows ssh + Kasm ports only).
IFACE="$(nmcli -t -f DEVICE,STATE device | awk -F: '$2=="connected" && $1!="lo" {print $1; exit}')"
if [[ -n "$IFACE" ]]; then
  firewall-cmd --permanent --zone=fcos-workspace --change-interface="$IFACE" || true
fi

firewall-cmd --reload || true
systemctl enable --now firewalld.service || true
exit 0
