#!/bin/sh
# firewalld is a dbus-activated service — the container must run its own
# dbus-daemon first. Host netns is shared (network_mode: host), so the
# nftables ruleset firewalld programs applies to the VM host.
set -e

# dbus needs a machine-id; generate a stable one if absent.
if [ ! -f /etc/machine-id ] || [ "$(cat /etc/machine-id)" = "uninitialized" ]; then
    dbus-uuidgen --ensure=/etc/machine-id >/dev/null 2>&1 || true
fi

# Start the system bus if it isn't already (idempotent).
if ! dbus-send --system --print-reply --dest=org.freedesktop.DBus / org.freedesktop.DBus.ListNames >/dev/null 2>&1; then
    mkdir -p /run/dbus
    dbus-uuidgen --ensure 2>/dev/null || true
    dbus-daemon --system --fork
fi

exec /usr/sbin/firewalld --nofork --nopid "$@"
