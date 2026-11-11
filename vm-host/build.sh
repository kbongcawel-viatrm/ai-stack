#!/usr/bin/env bash
# vm-host/build.sh — composable Butane -> merged Ignition. Pure Butane
# pipeline; no Ansible, no GitHub runner required.
#
# Method (per .agents/skills/fcos-kasm-platform):
#   1. Stage a rendered copy of the tree with ${FCOS_*} substituted.
#   2. Transpile each butane_modules/*.bu standalone (butane --strict
#      --files-dir) into an .ign fragment.
#   3. Generate root.bu with ignition.config.merge listing the selected
#      fragments; butane merges them at transpile time into vm-host.ign.
#
# Feature toggles (1 = merge the module; default all on):
#   ENABLE_HOME_SECURITY only — the containerized stack (50-container-stack)
#   is always merged; per-service selection happens at runtime via compose
#   profiles (edge/kasm/audit), not at build time.
# Modules: 00-base-system, 05-zincati-maintenance, 50-container-stack are
# always merged.
set -Eeuo pipefail
cd "$(dirname "$0")"

: "${FCOS_SSH_PUBLIC_KEY:?set FCOS_SSH_PUBLIC_KEY to the core user pubkey}"
: "${FCOS_CORE_PASSWORD_HASH:?set FCOS_CORE_PASSWORD_HASH (openssl passwd -6)}"
FCOS_LAN_IP="${FCOS_LAN_IP:-192.168.1.201}"
FCOS_LAN_CIDR="${FCOS_LAN_CIDR:-192.168.1.0/24}"
FCOS_GATEWAY="${FCOS_GATEWAY:-192.168.1.1}"
FCOS_INTERFACE="${FCOS_INTERFACE:-ens2}"
export FCOS_LAN_IP FCOS_LAN_CIDR FCOS_GATEWAY FCOS_INTERFACE

ENABLE_HOME_SECURITY="${ENABLE_HOME_SECURITY:-1}"

BUTANE="${BUTANE:-}"
if [[ -z "$BUTANE" ]]; then
  if command -v butane >/dev/null 2>&1; then BUTANE=butane
  elif [[ -x "$HOME/.local/bin/butane" ]]; then BUTANE="$HOME/.local/bin/butane"
  else echo "butane not found; install v0.23.0 or set BUTANE=" >&2; exit 1; fi
fi

WORK="${WORK:-$(mktemp -d /tmp/vm-host-build.XXXXXX)}"
KEEP_WORK="${KEEP_WORK:-0}"
trap '[[ "$KEEP_WORK" == 1 ]] || rm -rf "$WORK"' EXIT
STAGE="$WORK/tree"; FRAG="$WORK/frag"
mkdir -p "$STAGE" "$FRAG"

# --- 1. Stage + substitute ${FCOS_*} across rendered fragment types --------
cp -a "$PWD/." "$STAGE/"
rm -rf "$STAGE/build" "$STAGE/vm-host.ign"

python3 - "$STAGE" <<'PY'
import os, re, sys
allowed = {"FCOS_SSH_PUBLIC_KEY","FCOS_CORE_PASSWORD_HASH","FCOS_LAN_IP","FCOS_LAN_CIDR","FCOS_GATEWAY","FCOS_INTERFACE"}
exts = {".bu", ".conf", ".yaml", ".yml", ".xml", ".rules", ".toml", ".sh", ".service"}
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

# --- 2. Transpile every module standalone -----------------------------------
shopt -s nullglob
for bu in "$STAGE"/butane_modules/*.bu; do
  name="$(basename "$bu" .bu)"
  "$BUTANE" --strict --files-dir "$STAGE" --output "$FRAG/$name.ign" "$bu"
done
shopt -u nullglob

# --- 3. Merge selected modules via ignition.config.merge --------------------
merge=(00-base-system 05-zincati-maintenance 50-container-stack)
[[ "$ENABLE_HOME_SECURITY" == 1 ]] && merge+=(40-home-security)

{
  echo "variant: fcos"
  echo "version: 1.5.0"
  echo "ignition:"
  echo "  config:"
  echo "    merge:"
  for m in "${merge[@]}"; do echo "      - local: $m.ign"; done
} > "$WORK/root.bu"

"$BUTANE" --strict --files-dir "$FRAG" --output "$PWD/vm-host.ign" "$WORK/root.bu"
python3 -m json.tool "$PWD/vm-host.ign" >/dev/null
echo "Rendered: $PWD/vm-host.ign"
echo "Modules:   ${merge[*]}"
