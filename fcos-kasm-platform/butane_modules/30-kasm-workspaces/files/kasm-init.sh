#!/usr/bin/env bash
# kasm-init.sh — post-layering Kasm/home-security bring-up.
#
# /opt is read-only after first boot, so the Ignition-provisioned compose file
# is staged into /var/opt/kasm together with a generated .env (KASM_VNC_PASSWORD)
# exactly once. Then the lifecycle units are enabled.
#
# Runs once per boot after rpm-ostree packages exist; every step idempotent.
set -uo pipefail

STAMP=/var/lib/rpm-ostree-install.stamp
[[ -f "$STAMP" ]] || exit 0

install -d -m 0755 /var/opt/kasm
install -m 0644 /opt/kasm/docker-compose.yaml /var/opt/kasm/docker-compose.yaml

if [[ ! -f /var/opt/kasm/.env ]]; then
  ( umask 077; printf 'KASM_VNC_PASSWORD=%s\n' "$(head -c18 /dev/urandom | base64)" > /var/opt/kasm/.env )
  echo "kasm-init: generated /var/opt/kasm/.env (KASM_VNC_PASSWORD)" >&2
fi
# Readable by the core group so kasm_configurator can fetch it over SSH
# without privilege escalation (run0/polkit may prompt non-interactively).
chown root:core /var/opt/kasm/.env 2>/dev/null || true
chmod 0640 /var/opt/kasm/.env

systemctl enable --now kasm-workspace.service || true
systemctl enable --now container-update.timer || true

# home-security.service only exists when enable_home_security rendered it in.
if [[ -f /etc/systemd/system/home-security.service ]]; then
  systemctl enable --now home-security.service || true
fi

exit 0
