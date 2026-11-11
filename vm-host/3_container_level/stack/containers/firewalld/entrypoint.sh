#!/bin/sh
# firewalld is a dbus-activated service — the container must run its own
# system bus first. Host netns is shared (network_mode: host), so the
# nftables ruleset firewalld programs applies to the VM host.
set -e

# machine-id for the bus
if [ ! -f /etc/machine-id ] || [ "$(cat /etc/machine-id)" = "uninitialized" ]; then
    dbus-uuidgen --ensure=/etc/machine-id >/dev/null 2>&1 || true
fi

# Start the system bus if it isn't already (idempotent).
if ! dbus-send --system --print-reply --dest=org.freedesktop.DBus / org.freedesktop.DBus.ListNames >/dev/null 2>&1; then
    mkdir -p /run/dbus
    # podman restarts reuse the container fs — clear stale bus artifacts
    rm -f /run/dbus/pid /run/dbus/system_bus_socket
    dbus-daemon --system --fork
fi

exec /usr/sbin/firewalld --nofork --nopid "$@"
