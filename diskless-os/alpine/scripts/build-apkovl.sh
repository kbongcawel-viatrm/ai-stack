#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APKVOL_ROOT="${APKVOL_ROOT:-$SCRIPT_DIR/../apkovl}"
OUTPUT="${1:-$PWD/host.apkovl.tar.gz}"
SSH_PUBLIC_KEY="${ALPINE_SSH_PUBLIC_KEY:?Set ALPINE_SSH_PUBLIC_KEY to a public key}"
HOST_NIC="${ALPINE_HOST_NIC:-enp1s0}"

[[ -d "$APKVOL_ROOT" ]] || { echo "Missing apkovl source: $APKVOL_ROOT" >&2; exit 1; }
[[ "$HOST_NIC" =~ ^[a-zA-Z0-9_.:-]+$ ]] || { echo "Invalid interface name: $HOST_NIC" >&2; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
root="$work/root"
mkdir -p "$root"
cp -a "$APKVOL_ROOT/." "$root/"

install -d -m 0700 "$root/root/.ssh"
printf '%s\n' "$SSH_PUBLIC_KEY" > "$root/root/.ssh/authorized_keys"
chmod 0600 "$root/root/.ssh/authorized_keys"
ssh-keygen -lf "$root/root/.ssh/authorized_keys" >/dev/null

install -d -m 0755 "$root/etc/network" "$root/etc/runlevels/boot" "$root/etc/runlevels/default"
sed -i -e "s/^auto enp1s0$/auto $HOST_NIC/" -e "s/^iface enp1s0 inet manual$/iface $HOST_NIC inet manual/" -e "s/^    bridge-ports enp1s0$/    bridge-ports $HOST_NIC/" "$root/etc/network/interfaces"

# OpenRC runlevel links are part of the overlay so SSH and libvirt survive
# every diskless boot without relying on manual rc-update commands.
ln -sfn /etc/init.d/networking "$root/etc/runlevels/boot/networking"
ln -sfn /etc/init.d/modules "$root/etc/runlevels/boot/modules"
ln -sfn /etc/init.d/sshd "$root/etc/runlevels/default/sshd"
ln -sfn /etc/init.d/libvirtd "$root/etc/runlevels/default/libvirtd"

chmod 0600 "$root/etc/ssh/sshd_config"
chmod 0644 "$root/etc/ssh/sshd_config.d/00-local-security.conf"
chmod 0644 "$root/etc/apk/world" "$root/etc/apk/repositories"

mkdir -p "$(dirname -- "$OUTPUT")"
tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner \
  -cf - -C "$root" . | gzip -n > "$OUTPUT"

tar -tzf "$OUTPUT" >/dev/null
sha256sum "$OUTPUT"
echo "Built Alpine diskless apkovl: $OUTPUT"
