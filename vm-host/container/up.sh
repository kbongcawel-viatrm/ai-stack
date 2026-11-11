#!/usr/bin/env bash
# vm-host/container/up.sh — run the provisioning pipeline inside a disposable
# container. Run on the HOST (rootless podman).
#
# What lives where:
#   container layer   tools + temp files — destroyed on exit (--rm)
#   $STATE_DIR        base image, overlay, ignition, domain XML — persists
#                     on the host until you `rm -rf` it (default ~/fcos-vm)
#   host libvirt      the VM domain + running guest — the actual product
#
# Usage:
#   FCOS_SSH_PUBLIC_KEY=... FCOS_CORE_PASSWORD_HASH=... ./container/up.sh
#   STATE_DIR=/elsewhere VM_NAME=fcos-test ./container/up.sh
#
# Env passthrough: podman 5.8 has no --env-host, so pass each known var as
# '-e VAR' (value imported from this shell's environment). deploy.sh vars
# (VM_NAME, VM_RAM_MB, VM_VCPUS, VM_DISK_GB, BRIDGE, FCOS_LAN_IP,
# FCOS_QCOW2_URL, ...) all work the same as host-direct deploy.
set -Eeuo pipefail
cd "$(dirname "$0")/.."

IMAGE="${IMAGE:-localhost/fcos-vm-provision:latest}"
STATE_DIR="${STATE_DIR:-$HOME/fcos-vm}"
NAME="${NAME:-fcos-vm-provision}"

if ! podman image exists "$IMAGE" 2>/dev/null; then
  echo "[up] building $IMAGE"
  podman build -t "$IMAGE" container/
fi

mkdir -p "$STATE_DIR"
# The host qemu user must be able to traverse into the image dir.
chmod 0755 "$STATE_DIR"

# Mounts:
#   /work              vm-host source (rw)
#   $STATE_DIR         same absolute path inside — domain XML references it
#   /run/libvirt       host libvirt sockets (world-writable srw-rw-rw-)
#   /etc/libvirt       client config, read-only
#   /dev/kvm           required by deploy.sh's precondition check
# --security-opt label=type:spc_t: the container SELinux context cannot
# connect() to the libvirt unix sockets; spc_t keeps SELinux enforcing but
# allows socket access. Verified on Secureblue with libvirt socket perms
# srw------- root:root and the connecting uid mapped to the host user.
# NOTE: no :z/:Z relabel — qemu on the host must still be able to read the
# disks/ignition files written here (deploy.sh falls back to world-readable).
ENVS=()
for v in FCOS_SSH_PUBLIC_KEY FCOS_CORE_PASSWORD_HASH \
         FCOS_LAN_IP FCOS_LAN_CIDR FCOS_GATEWAY FCOS_INTERFACE \
         ENABLE_FIREWALLD ENABLE_SURICATA ENABLE_CLAMAV ENABLE_AIDE \
         ENABLE_LYNIS ENABLE_KASM ENABLE_HOME_SECURITY \
         VM_NAME VM_RAM_MB VM_VCPUS VM_DISK_GB BRIDGE LIBVIRT_URI \
         FCOS_QCOW2_URL FCOS_QCOW2_SHA256 FCOS_STREAM_JSON \
         RECREATE_OVERLAY WAIT_SSH IGN_FILE; do
  [[ -n "${!v:-}" ]] && ENVS+=(-e "$v")
done

exec podman run --rm --replace --name "$NAME" "${ENVS[@]}" \
  -e IMAGE_DIR="$STATE_DIR" \
  -v "$PWD:/work" \
  -v "$STATE_DIR:$STATE_DIR" \
  -v /run/libvirt:/run/libvirt \
  -v /etc/libvirt:/etc/libvirt:ro \
  --device /dev/kvm \
  --security-opt label=type:spc_t \
  "$IMAGE" /work/container/entrypoint.sh
