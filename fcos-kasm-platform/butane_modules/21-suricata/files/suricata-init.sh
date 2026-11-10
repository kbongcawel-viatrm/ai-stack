#!/usr/bin/env bash
# suricata-init.sh — post-layering Suricata bring-up (ET Open rules + service).
# Runs once per boot after rpm-ostree packages exist; every step idempotent.
set -uo pipefail

STAMP=/var/lib/rpm-ostree-install.stamp
RULES_STAMP=/var/lib/suricata-update.stamp
[[ -f "$STAMP" ]] || exit 0

# Runtime dirs must exist and be traversable by the packaged 'suricata' user.
# /etc/suricata must be world-traversable (0755) — 0750 root:root locks the
# service out of its own config (capabilities drop DAC override).
install -d -m 0755 /etc/suricata
install -d -m 0750 /var/lib/suricata/rules /var/log/suricata /var/run/suricata
chown -R suricata:suricata /etc/suricata /var/lib/suricata /var/log/suricata /var/run/suricata 2>/dev/null || true

# Fetch ET Open rules exactly once. A dedicated stamp is required: the
# provisioned local.rules already matches *.rules, so a glob check would
# wrongly skip the initial suricata-update run.
if [[ ! -f "$RULES_STAMP" ]]; then
  suricata-update update-sources || true
  suricata-update enable-source et/open || true
  suricata-update || true
  touch "$RULES_STAMP"
fi

systemctl enable --now suricata.service || true
exit 0
