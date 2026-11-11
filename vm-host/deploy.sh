#!/usr/bin/env bash
# vm-host/deploy.sh — provision the FCOS + Kasm VM directly on the hypervisor.
# No GitHub Actions, no Ansible: run this on the host OS (Secureblue/Arch/etc.),
# or rootless inside a Toolbox/podman container with LIBVIRT_URI=qemu:///session.
#
# Prerequisites on the host:
#   virsh/virt-install (libvirt), qemu-img, curl, xz, sha256sum, python3,
#   /dev/kvm, and the LAN bridge (br0) already configured.
#   Must be able to write /var/lib/libvirt/images and chown to qemu —
#   on Secureblue re-run as:  run0 ./deploy.sh
#
# Rootless (qemu:///session) mode — no root, no br0, no host install:
#   LIBVIRT_URI=qemu:///session ./deploy.sh
#   - runs as your user; images live in $HOME/.local/share/libvirt/images
#     (override with IMAGE_DIR)
#   - starts a session virtqemud if none is running
#   - networking: passt user-mode backend with mapped='on', so the guest
#     keeps its static LAN IP (192.168.1.201) and is reachable from the
#     host at that address. Other LAN machines cannot reach it.
#   - passt must be installed (Toolbox: sudo dnf install passt); /dev/kvm
#     must be exposed to the container
#   Requires libvirt >= 10.0 for the passt mapped attribute.
#
# Flow:
#   1. Verify tools, KVM, bridge, Ignition file (render by ./build.sh first).
#   2. Fetch the FCOS stable qemu qcow2.xz (pinned via FCOS_QCOW2_URL /
#      FCOS_QCOW2_SHA256, else resolved from the official stream metadata),
#      verify sha256, decompress once into IMAGE_DIR/base.
#   3. (Optional, OFF by default) create a fresh writable overlay disk.
#   4. Install the Ignition file, define + start the domain via virt-install
#      with fw_cfg Ignition injection, persist the domain XML.
#   5. Wait for guest SSH unless WAIT_SSH=0.
#
# Idempotency: re-running skips downloads that already verify. It never
# destroys an existing domain; undefine/cleanup is an explicit `make clean`.
set -Eeuo pipefail
cd "$(dirname "$0")"

VM_NAME="${VM_NAME:-fcos-kasm}"
VM_RAM_MB="${VM_RAM_MB:-4096}"
VM_VCPUS="${VM_VCPUS:-2}"
VM_DISK_GB="${VM_DISK_GB:-75}"
BRIDGE="${BRIDGE:-br0}"
FCOS_LAN_IP="${FCOS_LAN_IP:-192.168.1.201}"
LIBVIRT_URI="${LIBVIRT_URI:-qemu:///system}"
IMAGE_DIR="${IMAGE_DIR:-}"
IGN_FILE="${IGN_FILE:-$PWD/vm-host.ign}"
FCOS_STREAM_JSON="${FCOS_STREAM_JSON:-https://builds.coreos.fedoraproject.org/streams/stable.json}"
FCOS_QCOW2_URL="${FCOS_QCOW2_URL:-}"
FCOS_QCOW2_SHA256="${FCOS_QCOW2_SHA256:-}"
RECREATE_OVERLAY="${RECREATE_OVERLAY:-0}"
WAIT_SSH="${WAIT_SSH:-1}"

log()  { echo "[deploy] $*"; }
die()  { echo "[deploy] ERROR: $*" >&2; exit 1; }

# --- 0. Mode selection: system (privileged) vs session (rootless) -----------
IS_SESSION=0
case "$LIBVIRT_URI" in *session*) IS_SESSION=1 ;; esac
if [[ -z $IMAGE_DIR ]]; then
  if [[ $IS_SESSION -eq 1 ]]; then IMAGE_DIR="$HOME/.local/share/libvirt/images"
  else IMAGE_DIR="/var/lib/libvirt/images"; fi
fi
[[ $IS_SESSION -eq 1 ]] && log "rootless session mode (qemu:///session)"

# Image paths depend on IMAGE_DIR, so derive them after mode selection.
BASE_QCOW2="$IMAGE_DIR/base/fcos-base.qcow2"
OVERLAY="$IMAGE_DIR/$VM_NAME.qcow2"
IGN_DEST="$IMAGE_DIR/ignition/$(basename "$IGN_FILE")"
DOMAIN_XML="$IMAGE_DIR/domains/$VM_NAME.xml"

# --- 1. Preconditions -------------------------------------------------------
[[ $IS_SESSION -eq 1 || $EUID -eq 0 ]] || die "must run as root (Secureblue: run0 ./deploy.sh)"
for bin in virsh virt-install qemu-img curl xz sha256sum python3; do
  command -v "$bin" >/dev/null 2>&1 || die "missing tool: $bin"
done
[[ -c /dev/kvm ]]              || die "/dev/kvm not present (enable VT-x)"
[[ -e $IGN_FILE ]]              || die "Ignition config not found: $IGN_FILE (run ./build.sh first)"
if ! virsh -c "$LIBVIRT_URI" uri >/dev/null 2>&1; then
  if [[ $IS_SESSION -eq 0 ]]; then die "cannot connect to $LIBVIRT_URI"; fi
  command -v virtqemud >/dev/null 2>&1 || die "no session libvirtd; install 'libvirt' in the container"
  log "starting session virtqemud…"
  setsid virtqemud --session >/dev/null 2>&1 < /dev/null &
  ok=0
  for _ in $(seq 1 20); do
    virsh -c "$LIBVIRT_URI" uri >/dev/null 2>&1 && ok=1 && break
    sleep 1
  done
  [[ $ok -eq 1 ]] || die "session virtqemud did not come up"
fi
mkdir -p "$IMAGE_DIR"
[[ -w $IMAGE_DIR ]]             || die "not writable: $IMAGE_DIR"
if [[ $IS_SESSION -eq 1 ]]; then
  command -v passt >/dev/null 2>&1 || die "rootless mode requires passt (Toolbox: sudo dnf install passt)"
else
  ip link show dev "$BRIDGE" >/dev/null 2>&1 || die "bridge $BRIDGE missing (run prepare-hypervisor or setup-br0.sh)"
fi
if virsh -c "$LIBVIRT_URI" dominfo "$VM_NAME" >/dev/null 2>&1; then
  die "domain '$VM_NAME' already exists; this script never overwrites a VM (see 'make clean')"
fi

# --- 2. Base image: resolve, download, verify --------------------------------
if [[ -n $FCOS_QCOW2_URL && -z $FCOS_QCOW2_SHA256 ]] \
  || [[ -z $FCOS_QCOW2_URL && -n $FCOS_QCOW2_SHA256 ]]; then
  die "set FCOS_QCOW2_URL and FCOS_QCOW2_SHA256 together, or neither (auto-resolve stable)"
fi

if [[ -z $FCOS_QCOW2_URL ]]; then
  log "resolving latest FCOS stable qemu image from stream metadata…"
  read -r FCOS_QCOW2_URL FCOS_QCOW2_SHA256 < <(curl -fsSL "$FCOS_STREAM_JSON" | python3 -c '
import json, sys
d = json.load(sys.stdin)["architectures"]["x86_64"]["artifacts"]["qemu"]["formats"]["qcow2.xz"]
if "disk" in d:  # new stream schema (2026+)
    print(d["disk"]["location"], d["disk"]["sha256"])
else:  # legacy schema
    disk = d["disks"]["x86_64"]
    print(disk["path"], disk["sha256"])')
fi
log "image: $FCOS_QCOW2_URL"
[[ $FCOS_QCOW2_URL == https://* ]] || die "only https:// image sources are supported here"

mkdir -p "$IMAGE_DIR/base" "$IMAGE_DIR/ignition" "$IMAGE_DIR/domains"

xz_path="$IMAGE_DIR/base/fcos-base.qcow2.xz"
if [[ ! -f $BASE_QCOW2 ]]; then
  curl -fL --retry 3 --connect-timeout 15 -o "$xz_path.part" "$FCOS_QCOW2_URL"
  echo "$FCOS_QCOW2_SHA256  $xz_path.part" | sha256sum -c -
  mv "$xz_path.part" "$xz_path"
  xz -d "$xz_path"            # removes the .xz file
  log "base image decompressed"
elif [[ -f $xz_path ]]; then
  echo "$FCOS_QCOW2_SHA256  $xz_path" | sha256sum -c - && xz -d "$xz_path"
fi
[[ $(qemu-img info --output=json "$BASE_QCOW2") == *'"format": "qcow2"'* ]] \
  || die "$BASE_QCOW2 is not a qcow2 image"

# --- 3. Writable overlay ------------------------------------------------------
if [[ ! -f $OVERLAY || $RECREATE_OVERLAY == 1 ]]; then
  if [[ $RECREATE_OVERLAY == 1 && -f $OVERLAY ]]; then
    log "RECREATE_OVERLAY=1: disposing of old overlay (domain must not exist)"
    rm -f "$OVERLAY"
  fi
  qemu-img create -f qcow2 -F qcow2 -b "$BASE_QCOW2" "$OVERLAY" "${VM_DISK_GB}G"
else
  log "reusing existing overlay: $OVERLAY (RECREATE_OVERLAY=1 to replace)"
fi
if [[ $IS_SESSION -eq 0 ]]; then
  # Unprivileged runs (rootless container as qemu:///system) cannot chown to
  # qemu:qemu — virtqemud assigns disk ownership when the domain starts.
  chown qemu:qemu "$OVERLAY" 2>/dev/null \
    || log "chown to qemu:qemu skipped (unprivileged); libvirt sets ownership at boot"
  chmod 0660 "$OVERLAY"
  command -v restorecon >/dev/null 2>&1 && restorecon -F "$OVERLAY" || true
else
  chmod 0660 "$OVERLAY"
fi

# --- 4. Ignition + domain -----------------------------------------------------
install -m 0644 "$IGN_FILE" "$IGN_DEST"
chown qemu:qemu "$IGN_DEST" 2>/dev/null || true
restorecon -F "$IGN_DEST" 2>/dev/null || true

log "defining + starting domain '$VM_NAME' (Ignition via fw_cfg, first boot only)"
if [[ $IS_SESSION -eq 1 ]]; then
  # No br0 rootless: passt user networking with mapped guest address, so
  # the guest keeps its static LAN IP and stays reachable from the host.
  virt-install \
    --connect "$LIBVIRT_URI" \
    --name "$VM_NAME" \
    --memory "$VM_RAM_MB" \
    --vcpus "$VM_VCPUS" \
    --cpu host-passthrough \
    --osinfo detect=on,require=off \
    --import \
    --disk "path=$OVERLAY,format=qcow2,bus=virtio" \
    --network user,backend.type=passt,model.type=virtio \
    --graphics none \
    --noautoconsole \
    --qemu-commandline="-fw_cfg name=opt/com.coreos/config,file=$IGN_DEST" \
    --dry-run --print-xml=1 > "$DOMAIN_XML.draft"
  if ! grep -q '<backend type="passt"' "$DOMAIN_XML.draft"; then
    die "virt-install did not render the passt backend (need virt-install >= 5.0)"
  fi
  sed -i 's|<backend type="passt"/>|<backend type="passt" mapped="on"/>|' "$DOMAIN_XML.draft"
  mv "$DOMAIN_XML.draft" "$DOMAIN_XML"
  virsh -c "$LIBVIRT_URI" define "$DOMAIN_XML"
  virsh -c "$LIBVIRT_URI" autostart "$VM_NAME" >/dev/null 2>&1 || true
  virsh -c "$LIBVIRT_URI" start "$VM_NAME"
else
  virt-install \
    --connect "$LIBVIRT_URI" \
    --name "$VM_NAME" \
    --memory "$VM_RAM_MB" \
    --vcpus "$VM_VCPUS" \
    --cpu host-passthrough \
    --osinfo detect=on,require=off \
    --import \
    --disk "path=$OVERLAY,format=qcow2,bus=virtio" \
    --network "bridge=$BRIDGE,model=virtio" \
    --graphics none \
    --noautoconsole \
    --autostart \
    --qemu-commandline="-fw_cfg name=opt/com.coreos/config,file=$IGN_DEST"
  virsh -c "$LIBVIRT_URI" dumpxml "$VM_NAME" > "$DOMAIN_XML"
fi
log "domain XML persisted: $DOMAIN_XML"

# --- 5. Wait for guest SSH ----------------------------------------------------
if [[ $WAIT_SSH == 1 ]]; then
  log "waiting for SSH at $FCOS_LAN_IP (first boot reboots once for rpm-ostree layering)…"
  for _ in $(seq 1 90); do
    if (echo > /dev/tcp/"$FCOS_LAN_IP"/22) >/dev/null 2>&1; then
      log "VM '$VM_NAME' up: ssh core@$FCOS_LAN_IP (Kasm web on https://$FCOS_LAN_IP after finalize)"
      exit 0
    fi
    sleep 10
  done
  die "SSH not reachable at $FCOS_LAN_IP after 15 min — check: virsh -c $LIBVIRT_URI console $VM_NAME"
fi
log "done (SSH wait skipped)."
