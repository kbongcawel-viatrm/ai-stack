#!/usr/bin/env bash
#
# install-lynis-daily.sh
# Installs a daily Lynis systemd service and timer.
#
# Run:
#   run0 -i bash ./install-lynis-daily.sh
# Optional immediate scan:
#   run0 -i bash ./install-lynis-daily.sh --run-now
#
set -Eeuo pipefail

SERVICE_NAME="lynis-daily"
SCRIPT_PATH="/usr/local/sbin/lynis-daily.sh"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}.service"
TIMER_PATH="/etc/systemd/system/${SERVICE_NAME}.timer"
LOG_DIR="/var/log/lynis"
STATE_DIR="/var/lib/lynis"
LOGROTATE_PATH="/etc/logrotate.d/lynis"

RUN_NOW=0
if [[ "${1:-}" == "--run-now" ]]; then
    RUN_NOW=1
elif [[ $# -gt 0 ]]; then
    printf 'Usage: %s [--run-now]\n' "$0" >&2
    exit 2
fi

if [[ "${EUID}" -ne 0 ]]; then
    printf 'Run as root, for example: run0 -i bash %q\n' "$0" >&2
    exit 1
fi

LYNIS_BIN="$(command -v lynis || true)"
if [[ -z "$LYNIS_BIN" || ! -x "$LYNIS_BIN" ]]; then
    printf 'ERROR: Lynis was not found in PATH. Install Lynis first.\n' >&2
    exit 1
fi

command -v systemctl >/dev/null 2>&1 || {
    printf 'ERROR: systemctl was not found; systemd is required.\n' >&2
    exit 1
}

install -d -o root -g root -m 0750 "$LOG_DIR" "$STATE_DIR"

cat > "$SCRIPT_PATH" <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail

LYNIS_BIN="${LYNIS_BIN}"
LOG_DIR="${LOG_DIR}"
TIMESTAMP="\\$(date '+%Y%m%d-%H%M%S')"
LOG_FILE="\\${LOG_DIR}/lynis-\\${TIMESTAMP}.log"
LATEST_LINK="\\${LOG_DIR}/latest.log"
LATEST_TMP="\\${LOG_DIR}/.latest.log.tmp"

install -d -o root -g root -m 0750 "\\$LOG_DIR"

set +e
"\\$LYNIS_BIN" audit system --no-colors 2>&1 | tee "\\$LOG_FILE"
LYNIS_STATUS=\\${PIPESTATUS[0]}
set -e

chmod 0640 "\\$LOG_FILE"
ln -sfn "\\$(basename "\\$LOG_FILE")" "\\$LATEST_TMP"
mv -Tf "\\$LATEST_TMP" "\\$LATEST_LINK"

exit "\\$LYNIS_STATUS"
EOF

chown root:root "$SCRIPT_PATH"
chmod 0750 "$SCRIPT_PATH"

cat > "$SERVICE_PATH" <<'EOF'
[Unit]
Description=Daily Lynis Security Audit
Documentation=https://cisofy.com/lynis/
After=local-fs.target

[Service]
Type=oneshot
User=root
Group=root
ExecStart=/usr/local/sbin/lynis-daily.sh
UMask=0027
TimeoutStartSec=30min

# Basic hardening while preserving host visibility for the audit.
NoNewPrivileges=yes
PrivateTmp=yes
ProtectHome=read-only
ProtectSystem=full
ReadWritePaths=/var/log/lynis
ReadWritePaths=/var/lib/lynis
EOF
cat > "$TIMER_PATH" <<'UNIT'
[Unit]
Description=Daily Lynis Security Audit Timer

[Timer]
OnCalendar=*-*-* 03:00:00
RandomizedDelaySec=20m
Persistent=true
Unit=lynis-daily.service

[Install]
WantedBy=timers.target
UNIT

# Rotate the dated logs written by the audit script.
cat > "$LOGROTATE_PATH" <<'UNIT'
/var/log/lynis/*.log {
    weekly
    rotate 12
    missingok
    notifempty
    compress
    delaycompress
    dateext
    create 0640 root root
    sharedscripts
}
UNIT

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.timer"

if [[ "$RUN_NOW" -eq 1 ]]; then
    systemctl start "${SERVICE_NAME}.service"
fi

echo "Installed ${SERVICE_NAME}.timer (daily 03:00 + up to 15m jitter)."
