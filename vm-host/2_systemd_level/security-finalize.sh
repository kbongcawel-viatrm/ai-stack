#!/usr/bin/env bash
# security-finalize.sh — post-layering bootstrap for the FCOS VM host.
# Runs on every boot once /var/lib/vm-host-packages.stamp exists; every step
# is idempotent.
set -Eeuo pipefail

PKG_STAMP=/var/lib/vm-host-packages.stamp
AIDE_STAMP=/var/lib/vm-host-aide-init.stamp

# Only act after rpm-ostree layering has been applied (i.e., packages exist).
[[ -f "$PKG_STAMP" ]] || exit 0

# --- firewalld: bind the workspace zone to the guest NIC -------------------
IFACE="$(nmcli -t -f DEVICE,STATE device | awk -F: '$2=="connected" && $1!="lo" {print $1; exit}')"
if [[ -n "$IFACE" ]]; then
  firewall-cmd --permanent --zone=fcos-workspace --change-interface="$IFACE" || true
  firewall-cmd --reload || true
fi

# --- suricata: fetch ET Open rules once, then enable ------------------------
if ! compgen -G "/var/lib/suricata/rules/*.rules" >/dev/null; then
  suricata-update update-sources || true
  suricata-update enable-source et/open || true
  suricata-update || true
fi
chown -R suricata:suricata /etc/suricata /var/lib/suricata/rules /var/log/suricata /var/run/suricata 2>/dev/null || true
systemctl enable --now suricata.service || true

# --- clamav: initial definition download ------------------------------------
[[ -f /var/lib/clamav/main.cvd ]] || freshclam --quiet --config=/etc/clamav/freshclam.conf || true
systemctl enable --now clamav-daily.timer || true

# --- aide: one-time baseline, then daily checks ------------------------------
if [[ ! -f "$AIDE_STAMP" ]]; then
  install -d -m 0750 /var/lib/aide /var/log/aide
  aide --init --config=/etc/aide/aide.conf || true
  touch "$AIDE_STAMP"
fi
systemctl enable --now aide-daily.timer || true

# --- lynis + container updates ----------------------------------------------
systemctl enable --now lynis-daily.timer || true
systemctl enable --now container-update.timer || true

# --- kasm workspace lifecycle -------------------------------------------------
systemctl enable kasm-workspace.service || true
systemctl start kasm-workspace.service || true
systemctl enable home-security.service || true
systemctl start home-security.service || true

exit 0
