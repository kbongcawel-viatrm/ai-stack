#!/usr/bin/env bash
# vm-host/build.sh — render config.bu into Ignition and optionally deploy.
#
# Host-level activity: run on the hypervisor (Secureblue) or any Linux box
# with butane + qemu/libvirt. No GitHub runner, no secrets store.
#
# Required env:
#   FCOS_SSH_PUBLIC_KEY      pubkey authorized for user core
#   FCOS_CORE_PASSWORD_HASH  sha512-crypt hash for console login fallback
# Optional env:
#   FCOS_LAN_IP              guest static IP        (default 192.168.1.201)
#   FCOS_LAN_CIDR            guest LAN CIDR         (default 192.168.1.0/24)
#   FCOS_GATEWAY             guest gateway          (default 192.168.1.1)
#   FCOS_INTERFACE           guest NIC name         (default ens2)
#   BUTANE                   butane binary          (default: butane|~/.local/bin/butane)
#   DEPLOY=1                 also run deploy-fcos-vm.yml after rendering
#   FCOS_VM_NAME             libvirt domain name    (default fcos-kasm-poc)
set -Eeuo pipefail
cd "$(dirname "$0")"

: "${FCOS_SSH_PUBLIC_KEY:?set FCOS_SSH_PUBLIC_KEY to the core user pubkey}"
: "${FCOS_CORE_PASSWORD_HASH:?set FCOS_CORE_PASSWORD_HASH (openssl passwd -6)}"
FCOS_LAN_IP="${FCOS_LAN_IP:-192.168.1.201}"
FCOS_LAN_CIDR="${FCOS_LAN_CIDR:-192.168.1.0/24}"
FCOS_GATEWAY="${FCOS_GATEWAY:-192.168.1.1}"
FCOS_INTERFACE="${FCOS_INTERFACE:-ens2}"
FCOS_VM_NAME="${FCOS_VM_NAME:-fcos-kasm-poc}"

BUTANE="${BUTANE:-}"
if [[ -z "$BUTANE" ]]; then
  if command -v butane >/dev/null 2>&1; then BUTANE=butane
  elif [[ -x "$HOME/.local/bin/butane" ]]; then BUTANE="$HOME/.local/bin/butane"
  else echo "butane not found; install v0.23.0 or set BUTANE=" >&2; exit 1; fi
fi

WORK="${WORK:-$(mktemp -d /tmp/vm-host.XXXXXX)}"
trap '[[ "${KEEP_WORK:-0}" == 1 ]] || rm -rf "$WORK"' EXIT

export FCOS_SSH_PUBLIC_KEY FCOS_CORE_PASSWORD_HASH FCOS_LAN_IP FCOS_LAN_CIDR FCOS_GATEWAY FCOS_INTERFACE

# Stage a rendered copy of the whole tree: config.bu plus every payload file
# that may contain ${VAR} placeholders (suricata.yaml, firewall-rules.xml, ...).
STAGE="$WORK/tree"
mkdir -p "$STAGE"
cp -a "$PWD/." "$STAGE/"
rm -f "$STAGE/vm-host.ign"

python3 - "$STAGE" <<'PY'
import os, re, sys
allowed = {"FCOS_SSH_PUBLIC_KEY","FCOS_CORE_PASSWORD_HASH","FCOS_LAN_IP","FCOS_LAN_CIDR","FCOS_GATEWAY","FCOS_INTERFACE"}
exts = {".bu", ".conf", ".yaml", ".yml", ".xml", ".rules", ".toml"}
for root, _, files in os.walk(sys.argv[1]):
    for name in files:
        if os.path.splitext(name)[1] not in exts:
            continue
        p = os.path.join(root, name)
        s = open(p).read()
        out = re.sub(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}",
                     lambda m: os.environ[m.group(1)] if m.group(1) in allowed else m.group(0), s)
        if out != s:
            open(p, "w").write(out)
PY

"$BUTANE" --strict --files-dir="$STAGE" --output "$WORK/vm-host.ign" "$STAGE/config.bu"
python3 -m json.tool "$WORK/vm-host.ign" >/dev/null
cp "$WORK/vm-host.ign" "$PWD/vm-host.ign"
echo "Rendered: $PWD/vm-host.ign"

if [[ "${DEPLOY:-0}" == "1" ]]; then
  ANSIBLE="${ANSIBLE_PLAYBOOK:-$HOME/.local/share/fcos-deploy-venv/bin/ansible-playbook}"
  [[ -x "$ANSIBLE" ]] || ANSIBLE=ansible-playbook
  INVENTORY="${INVENTORY:-/tmp/fcos-inventory.yml}"
  "$ANSIBLE" -i "$INVENTORY" ../diskless-os/ansible/playbooks/deploy-fcos-vm.yml \
    -e "fcos_ignition_local_path=$PWD/vm-host.ign" \
    -e "fcos_vm_name=$FCOS_VM_NAME" \
    -e "fcos_lan_ip=$FCOS_LAN_IP" \
    -e fcos_qcow2_compressed=true \
    -e fcos_qcow2_uncompressed_sha256="${FCOS_QCOW2_UNCOMPRESSED_SHA256:?set when image is .xz}"
fi
