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
STATE_DIR="$(realpath -m "${STATE_DIR:-$HOME/fcos-vm}")"
NAME="${NAME:-fcos-vm-provision}"

if ! podman image exists "$IMAGE" 2>/dev/null; then
  echo "[up] building $IMAGE"
  podman build -t "$IMAGE" container/
fi

mkdir -p "$STATE_DIR"
# The host qemu user must be able to traverse into the image dir.
chmod 0755 "$STATE_DIR"
# podman-machine containers may only see/list/write host dirs labeled
# container_file_t (user_home_t is read-blocked for directory access).
# libvirt relabels the disk/ignition files itself at domain start, so this
# label only covers the container-side touch of the artifacts.
chcon -R -t container_file_t "$STATE_DIR" 2>/dev/null || true

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

# Transport selection (how the container talks to the HOST's libvirt):
#   TRANSPORT=socket  mount /run/libvirt + /dev/kvm (works when containers
#                     run directly on the hypervisor, e.g. devcontainer-
#                     style host mounts; the default there)
#   TRANSPORT=ssh     qemu+ssh://kim@192.168.1.100/system using ~/.ssh/vmhost-bot
#                     and the ~/.ssh/config alias — the rootless path on
#                     Secureblue, where podman containers live inside the
#                     podman machine and cannot reach host sockets
#   TRANSPORT=auto    (default) probe with a throwaway container
TRANSPORT="${TRANSPORT:-auto}"
HYPERVISOR="${HYPERVISOR:-192.168.1.100}"
if [[ "$TRANSPORT" == auto ]]; then
  if podman run --rm --device /dev/kvm -v /run/libvirt:/run/libvirt:ro \
        "$IMAGE" test -e /run/libvirt/libvirt-sock 2>/dev/null; then
    TRANSPORT=socket
  else
    TRANSPORT=ssh
  fi
  echo "[up] transport: $TRANSPORT"
fi

if [[ "$TRANSPORT" == ssh ]]; then
  [[ -f "$HOME/.ssh/vmhost-bot" ]] || {
    echo "[up] ssh transport needs ~/.ssh/vmhost-bot (authorized on $HYPERVISOR)" >&2
    exit 1
  }
  # Stage the identity in STATE_DIR: ssh_home_t files are unreadable to
  # containers, while user_home_t files are readable by explicit path.
  # entrypoint.sh installs them into ~/.ssh inside the container (correct
  # ownership) before running the pipeline.
  mkdir -p "$STATE_DIR/provision-ssh"
  cp "$HOME/.ssh/vmhost-bot" "$STATE_DIR/provision-ssh/vmhost-bot"
  [[ -f "$HOME/.ssh/known_hosts" ]] && cp "$HOME/.ssh/known_hosts" "$STATE_DIR/provision-ssh/known_hosts" || true
  chmod 600 "$STATE_DIR/provision-ssh"/*
  MOUNTS=(-v "$PWD:/work" -v "$STATE_DIR:$STATE_DIR" \
          -v "$STATE_DIR/provision-ssh:/root/.ssh-src" \
          --network=host)
  EXTRAS=(-e "LIBVIRT_URI=qemu+ssh://kim@$HYPERVISOR/system" \
          -e "PROV_SSH_HOST=$HYPERVISOR")
else
  # --security-opt label=type:spc_t: the container SELinux context cannot
  # connect() to the libvirt unix sockets; spc_t keeps SELinux enforcing but
  # allows socket access. NOTE: no :z/:Z relabel — qemu on the host must still
  # be able to read the disks/ignition files written here.
  MOUNTS=(-v "$PWD:/work" -v "$STATE_DIR:$STATE_DIR" \
          -v /run/libvirt:/run/libvirt -v /etc/libvirt:/etc/libvirt:ro \
          --device /dev/kvm --security-opt label=type:spc_t)
  EXTRAS=()
fi

exec podman run --rm --replace --name "$NAME" "${ENVS[@]}" \
  -e IMAGE_DIR="$STATE_DIR" \
  "${EXTRAS[@]}" \
  "${MOUNTS[@]}" \
  "$IMAGE" /work/container/entrypoint.sh
