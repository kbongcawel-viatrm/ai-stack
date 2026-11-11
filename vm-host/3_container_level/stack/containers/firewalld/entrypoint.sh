#!/bin/sh
# firewalld is a dbus-activated service — the container must run its own
# system bus first. Fedora ships dbus-broker (no dbus-daemon binary).
# Host netns is shared (network_mode: host), so the nftables ruleset
# firewalld programs applies to the VM host.
set -e

# machine-id for the bus
if [ ! -f /etc/machine-id ] || [ "$(cat /etc/machine-id)" = "uninitialized" ]; then
    dbus-uuidgen --ensure=/etc/machine-id >/dev/null 2>&1 || true
fi

# Start the system bus if it isn't already (idempotent).
# dbus-broker-launch expects its listen socket via LISTEN_FDS (normally
# supplied by systemd); systemd-socket-activate bridges that gap.
if ! dbus-send --system --print-reply --dest=org.freedesktop.DBus / org.freedesktop.DBus.ListNames >/dev/null 2>&1; then
    mkdir -p /run/dbus
    systemd-socket-activate --collect \
        -l /run/dbus/system_bus_socket \
        dbus-broker-launch --scope system &
    i=0
    while [ ! -S /run/dbus/system_bus_socket ] && [ $i -lt 50 ]; do
        sleep 0.1; i=$((i+1))
    done
fi

exec /usr/sbin/firewalld --nofork --nopid "$@"
