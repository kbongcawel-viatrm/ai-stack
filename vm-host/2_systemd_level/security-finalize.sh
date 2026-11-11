#!/usr/bin/env bash
# security-finalize.sh — post-layering bootstrap for the FCOS VM host.
# Runs on every boot once /var/lib/vm-host-packages.stamp exists; every step
# is idempotent.
set -Eeuo pipefail

PKG_STAMP=/var/lib/vm-host-packages.stamp
AIDE_STAMP=/var/lib/vm-host-aide-init.stamp
SURICATA_STAMP=/var/lib/suricata-rules.stamp
SWAP_FILE=/var/swap/swapfile
SWAP_SIZE="${SWAP_SIZE:-8G}"

# --- swap: FCOS ships without swap (ZRAM only); Kasm needs burst headroom --
# Runs before the package-stamp gate: swap is independent of rpm-ostree.
# / is read-only on FCOS — the swapfile must live under /var.
if [[ ! -f $SWAP_FILE ]]; then
  install -d -m 0750 /var/swap
  fallocate -l "$SWAP_SIZE" "$SWAP_FILE" && chmod 0600 "$SWAP_FILE" && mkswap "$SWAP_FILE" \
    || echo "[finalize] WARN: swap setup failed; continuing without swap" >&2
fi
grep -q "^$SWAP_FILE " /etc/fstab 2>/dev/null || echo "$SWAP_FILE none swap defaults 0 0" >> /etc/fstab
swapon -a || true

# Only act after rpm-ostree layering has been applied (i.e., packages exist).
[[ -f "$PKG_STAMP" ]] || exit 0

# --- firewalld: bind the workspace zone to the guest NIC -------------------
# NM may not be up yet on early boots; || true keeps pipefail+set -e from
# aborting the unit — the binding is retried on every subsequent boot.
IFACE="$(nmcli -t -f DEVICE,STATE device 2>/dev/null | awk -F: '$2=="connected" && $1!="lo" {print $1; exit}' || true)"
if [[ -n "$IFACE" ]]; then
  firewall-cmd --permanent --zone=fcos-workspace --change-interface="$IFACE" || true
  firewall-cmd --reload || true
fi

# --- suricata: fetch ET Open rules once, then enable ------------------------
# Dedicated stamp: a glob on *.rules would match the provisioned local.rules
# and skip the ET download entirely.
if [[ ! -f "$SURICATA_STAMP" ]] \
  && suricata-update update-sources \
  && suricata-update enable-source et/open \
  && suricata-update; then
  touch "$SURICATA_STAMP"
fi
chown -R suricata:suricata /etc/suricata /var/lib/suricata/rules /var/log/suricata 2>/dev/null || true
systemctl enable --now suricata.service || true

# --- clamav: initial definition download ------------------------------------
[[ -f /var/lib/clamav/main.cvd ]] || freshclam --quiet --config=/etc/clamav/freshclam.conf || true
systemctl enable --now clamav-daily.timer || true

# --- aide: one-time baseline, then daily checks ------------------------------
# aide --init writes database_out (.new.gz); promote it to database_in or
# every later --check finds no baseline. Stamp only on success so a failed
# init retries on the next boot.
if [[ ! -f "$AIDE_STAMP" ]]; then
  install -d -m 0750 /var/lib/aide /var/log/aide
  if aide --init --config=/etc/aide/aide.conf \
     && mv -f /var/lib/aide/aide.db.new.gz /var/lib/aide/aide.db.gz; then
    touch "$AIDE_STAMP"
  fi
fi
systemctl enable --now aide-daily.timer || true

# --- lynis + container updates ----------------------------------------------
systemctl enable --now lynis-daily.timer || true
systemctl enable --now container-update.timer || true

# --- kasm workspace lifecycle -------------------------------------------------
# /opt is a symlink to /var/opt on FCOS, so the Ignition-provisioned compose
# file is already at the runtime path — only the compose .env
# (KASM_VNC_PASSWORD) needs generating, exactly once.
if [[ -f /var/opt/kasm/docker-compose.yaml && ! -f /var/opt/kasm/.env ]]; then
  ( umask 077; printf 'KASM_VNC_PASSWORD=%s\n' "$(head -c18 /dev/urandom | base64)" > /var/opt/kasm/.env )
  echo "Kasm VNC password generated in /var/opt/kasm/.env" >&2
fi
systemctl enable kasm-workspace.service || true
systemctl start kasm-workspace.service || true
systemctl enable home-security.service || true
systemctl start home-security.service || true

exit 0
