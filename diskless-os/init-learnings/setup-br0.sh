#!/usr/bin/env bash
# setup-br0.sh — create and activate br0 bridge on the Secureblue hypervisor.
#
# Moves SLAVE_IF (enp1s0) under bridge br0, which takes over the host IP.
# Idempotent: safe to re-run. Rolls back automatically if verification fails.
#
# Usage: ./setup-br0.sh [-h|--help] [--skip-internet-check]
#
# Requires: NetworkManager (nmcli), run0 (or root). Connectivity drops
# briefly during cutover — run from local console if possible.

set -euo pipefail

BRIDGE="br0"
BRIDGE_IP="192.168.1.100/24"
GATEWAY="192.168.1.1"
DNS="192.168.1.1"
SLAVE_IF="enp1s0"
OLD_CONN=""          # discovered at runtime
SKIP_INTERNET=0

log()  { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
die()  { printf '[%s] ERROR: %s\n' "$(date '+%H:%M:%S')" "$*" >&2; exit 1; }

usage() {
    cat <<EOF
Usage: $0 [--skip-internet-check]

Creates bridge '$BRIDGE' with $BRIDGE_IP (gw $GATEWAY, dns $DNS),
enslaves $SLAVE_IF, and cuts over from the existing connection.
Automatically rolls back if post-checks fail.
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help) usage; exit 0 ;;
        --skip-internet-check) SKIP_INTERNET=1; shift ;;
        *) usage >&2; die "unknown argument: $1" ;;
    esac
done

# Privilege escalation: prefer run0 (Secureblue), fall back to sudo elsewhere.
if [[ $EUID -eq 0 ]]; then
    RUN0=()
elif command -v run0 >/dev/null 2>&1; then
    RUN0=(run0)
elif command -v sudo >/dev/null 2>&1; then
    RUN0=(sudo)
else
    die "need root, run0, or sudo"
fi
nmcli_root() { "${RUN0[@]}" nmcli "$@"; }

command -v nmcli >/dev/null 2>&1 || die "nmcli not found"
ip link show "$SLAVE_IF" >/dev/null 2>&1 || die "$SLAVE_IF not present"

rollback() {
    log "Rolling back: bringing down $BRIDGE, restoring previous connection"
    nmcli_root con down "$BRIDGE" 2>/dev/null || true
    [[ -n "$OLD_CONN" ]] && nmcli_root con up "$OLD_CONN" 2>/dev/null || true
}

verify() {
    # Poll for up to ~20s: bridge addressing/routes can lag activation.
    local i
    for i in $(seq 1 10); do
        ip -br addr show "$BRIDGE" 2>/dev/null | grep -q "$BRIDGE_IP" &&
        ip route | grep -q "default via $GATEWAY dev $BRIDGE" &&
        ping -c1 -W2 "$GATEWAY" >/dev/null 2>&1 &&
        { [[ $SKIP_INTERNET -eq 1 ]] || ping -c1 -W3 8.8.8.8 >/dev/null 2>&1; } &&
        return 0
        sleep 2
    done
    log "Verifying bridge state..."
    ip -br addr show "$BRIDGE" || true
    ip route || true
    return 1
}

# --- 1. Ensure bridge profile exists with manual addressing ---
if ! nmcli con show "$BRIDGE" >/dev/null 2>&1; then
    log "Creating bridge connection '$BRIDGE'"
    nmcli_root con add type bridge con-name "$BRIDGE" ifname "$BRIDGE"
fi
nmcli_root con mod "$BRIDGE" \
    ipv4.method manual \
    ipv4.addresses "$BRIDGE_IP" \
    ipv4.gateway "$GATEWAY" \
    ipv4.dns "$DNS" \
    ipv6.method disabled \
    bridge.stp no

# --- 2. Ensure $SLAVE_IF is enslaved to the bridge ---
SLAVE_CONN="${SLAVE_IF}-slave"
if ! nmcli con show "$SLAVE_CONN" >/dev/null 2>&1; then
    log "Enslaving $SLAVE_IF to $BRIDGE"
    nmcli_root con add type bridge-slave con-name "$SLAVE_CONN" \
        ifname "$SLAVE_IF" master "$BRIDGE"
else
    nmcli_root con mod "$SLAVE_CONN" master "$BRIDGE" ifname "$SLAVE_IF"
fi

# --- 3. Find and deactivate whatever currently owns $SLAVE_IF ---
OLD_CONN=$(nmcli -t -f NAME,DEVICE con show --active |
    awk -F: -v dev="$SLAVE_IF" '$2 == dev {print $1; exit}')
if [[ -n "$OLD_CONN" && "$OLD_CONN" != "$SLAVE_CONN" ]]; then
    log "Deactivating current connection '$OLD_CONN' on $SLAVE_IF"
    nmcli_root con down "$OLD_CONN"
    # Don't let it race the bridge back up on reboot.
    nmcli_root con mod "$OLD_CONN" connection.autoconnect no || true
fi

# --- 4. Cutover ---
log "Activating $BRIDGE (brief connectivity drop expected)"
nmcli_root con up "$BRIDGE"
# Give the slave port a moment if it didn't auto-activate.
sleep 2
nmcli_root con show "$SLAVE_CONN" --active >/dev/null 2>&1 || \
    nmcli_root con up "$SLAVE_CONN"

diagnose() {
    log "Diagnostics: ip -br addr"
    ip -br addr || true
    log "Diagnostics: ip route"
    ip route || true
    log "Diagnostics: nmcli device status"
    nmcli device status || true
    log "Diagnostics: nmcli -f ALL con show $BRIDGE (active fields)"
    nmcli -g connection.id,connection.interface-name,ipv4.method,ipv4.addresses,ipv4.gateway,ipv4.dns,ipv6.method con show "$BRIDGE" || true
}

# --- 5. Verify; roll back on failure ---
if verify; then
    log "SUCCESS: $BRIDGE is up with $BRIDGE_IP via $GATEWAY"
    ip -br addr show "$BRIDGE"
    ip route | grep "default via $GATEWAY" || true
    exit 0
fi

diagnose
log "Verification failed — attempting rollback"
rollback
if [[ -n "$OLD_CONN" ]]; then
    sleep 2
    if ping -c1 -W3 "$GATEWAY" >/dev/null 2>&1; then
        die "Rollback restored connectivity via '$OLD_CONN'. Check 'journalctl -u NetworkManager' for why $BRIDGE failed."
    fi
fi
die "Verification failed and rollback did not restore connectivity. Use local console to recover."
