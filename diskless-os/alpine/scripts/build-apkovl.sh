#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APKVOL_ROOT="${APKVOL_ROOT:-$SCRIPT_DIR/../apkovl}"
OUTPUT="${1:-$PWD/host.apkovl.tar.gz}"
SSH_PUBLIC_KEY="${ALPINE_SSH_PUBLIC_KEY:?Set ALPINE_SSH_PUBLIC_KEY to a public key}"
HOST_NIC="${ALPINE_HOST_NIC:-enp1s0}"
STORAGE_UUID="${ALPINE_STORAGE_UUID:-}"
STORAGE_MOUNTPOINT="${ALPINE_STORAGE_MOUNTPOINT:-/mnt/nvme}"
VM_STORAGE_PATH="${ALPINE_VM_STORAGE_PATH:-$STORAGE_MOUNTPOINT/libvirt/images}"
STORAGE_FSTYPE="${ALPINE_STORAGE_FSTYPE:-ext4}"

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

if [[ -n "$STORAGE_UUID" ]]; then
  [[ "$STORAGE_UUID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]] || { echo "Invalid ALPINE_STORAGE_UUID" >&2; exit 1; }
  [[ "$STORAGE_MOUNTPOINT" =~ ^/[A-Za-z0-9._/-]+$ && "$STORAGE_MOUNTPOINT" != "/" ]] || { echo "Invalid ALPINE_STORAGE_MOUNTPOINT" >&2; exit 1; }
  [[ "$VM_STORAGE_PATH" =~ ^/[A-Za-z0-9._/-]+$ && "$VM_STORAGE_PATH" == "$STORAGE_MOUNTPOINT/"* && "$VM_STORAGE_PATH" != *"/../"* ]] || { echo "ALPINE_VM_STORAGE_PATH must be a simple path beneath ALPINE_STORAGE_MOUNTPOINT" >&2; exit 1; }
  [[ "$STORAGE_FSTYPE" == "ext4" ]] || { echo "Only ext4 persistent storage is supported by this apkovl" >&2; exit 1; }
  install -d -m 0755 "$root$STORAGE_MOUNTPOINT" "$root/etc/conf.d"
  printf 'UUID=%s %s %s defaults,noatime 0 2\n' "$STORAGE_UUID" "$STORAGE_MOUNTPOINT" "$STORAGE_FSTYPE" >> "$root/etc/fstab"
  cat > "$root/etc/conf.d/libvirt-vms" <<EOF
LIBVIRT_STORAGE_MOUNTPOINT="$STORAGE_MOUNTPOINT"
LIBVIRT_DOMAIN_DIR="$VM_STORAGE_PATH/domains"
EOF
  chmod 0644 "$root/etc/conf.d/libvirt-vms"
  ln -sfn /etc/init.d/localmount "$root/etc/runlevels/boot/localmount"
  ln -sfn /etc/init.d/libvirt-vms "$root/etc/runlevels/default/libvirt-vms"
else
  rm -f "$root/etc/init.d/libvirt-vms" "$root/etc/conf.d/libvirt-vms" "$root/etc/runlevels/default/libvirt-vms"
fi

chmod 0600 "$root/etc/ssh/sshd_config"
chmod 0644 "$root/etc/ssh/sshd_config.d/00-local-security.conf"
chmod 0644 "$root/etc/apk/world" "$root/etc/apk/repositories"

mkdir -p "$(dirname -- "$OUTPUT")"
tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner \
  -cf - -C "$root" . | gzip -n > "$OUTPUT"

tar -tzf "$OUTPUT" >/dev/null
sha256sum "$OUTPUT"
echo "Built Alpine diskless apkovl: $OUTPUT"
