#!/bin/bash
# Collection script for session forensics data
# Collects host-level session data for security forensics analysis

set -euo pipefail

# Configuration
OUTPUT_DIR="/tmp/session-forensics-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTPUT_DIR"
HOSTNAME=$(hostname)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
INTERVAL_MINUTES=5

# Ensure jq is available for JSON processing
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Install with: sudo apt-get install jq or sudo yum install jq" >&2
    exit 1
fi

# Collect session data
{
    echo "{\"metadata\":{\"timestamp\":\"$TIMESTAMP\",\"hostname\":\"$HOSTNAME\",\"interval_minutes\":$INTERVAL_MINUTES,\"collection_method\":\"script\"},
          \"session_data\":{"

    # who command - active users
    echo -n "\"who\":"
    who 2>/dev/null | jq -R -s -c 'split("\n")[:-1]' || echo '[]'
    echo -n ","

    # w command - system load and user logins
    echo -n "\"w\":"
    w 2>/dev/null | jq -R -s -c 'split("\n")[:-1]' || echo '[]'
    echo -n ","

    # loginctl list-sessions - active sessions
    echo -n "\"loginctl_sessions\":"
    loginctl list-sessions --no-legend 2>/dev/null | jq -R -s -c 'split("\n")[:-1]' || echo '[]'
    echo -n ","

    # last logins - recent login history
    echo -n "\"last_logins\":"
    last -n 50 2>/dev/null | jq -R -s -c 'split("\n")[:-1]' || echo '[]'
    echo -n ","

    # systemd journal auth events (last 5 minutes) - critical for security
    echo -n "\"auth_events\":"
    journalctl --since "$INTERVAL_MINUTES minutes ago" _UID=0 -t sshd -t sudo -t su -t polkit -t login -o json 2>/dev/null | jq -s '.' || echo '[]'
    echo -n ","

    # last command - system boot and login history
    echo -n "\"system_boot_history\":"
    last -x -n 20 2>/dev/null | grep -E "system boot|reboot|shutdown" | jq -R -s -c 'split("\n")[:-1]' || echo '[]'
    echo -n ","

    # ps aux for active processes (sample)
    echo -n "\"active_processes\":"
    ps aux --no-headers -w -w 2>/dev/null | head -100 | jq -R -s -c 'split("\n")[:-1]' || echo '[]'

    echo "}}"
} > "$OUTPUT_DIR/session-data.json"

# Validate the output
if [ ! -s "$OUTPUT_DIR/session-data.json" ]; then
    echo "Error: Failed to collect session data" >&2
    rm -rf "$OUTPUT_DIR"
    exit 1
fi

# Output file for Fluent Bit or other consumers
OUTPUT_FILE="/tmp/latest-session-forensics.json"
mv "$OUTPUT_DIR/session-data.json" "$OUTPUT_FILE"

# Keep the directory for debugging
# rm -rf "$OUTPUT_DIR"

echo "Session forensics data collected successfully: $OUTPUT_FILE"
echo "Host: $HOSTNAME"
echo "Timestamp: $TIMESTAMP"

# Exit successfully
exit 0
