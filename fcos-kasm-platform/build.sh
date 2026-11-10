#!/usr/bin/env bash
# fcos-kasm-platform/build.sh — host-level driver for the modular FCOS/Kasm
# provisioning pipeline. Wraps the Ansible roles in site.yml.
#
# Usage:
#   ./build.sh render       # butane modules -> build/config.ign
#   ./build.sh provision    # render + qcow2 overlay + libvirt domain
#   ./build.sh configure    # post-boot SSH config (.env fetch, Kasm API)
#   ./build.sh all          # render -> provision -> configure (default)
#   ./build.sh clean        # remove build/ artifacts
#
# Extra args are passed to ansible-playbook, e.g.:
#   ./build.sh render -e @profiles/kasm-only.yml
#
# Required env for render/provision:
#   FCOS_SSH_PUBLIC_KEY      pubkey authorized for user core
#   FCOS_CORE_PASSWORD_HASH  sha512-crypt hash for console login fallback
# Optional env:
#   BUTANE                   butane binary (default: butane|~/.local/bin/butane)
#   ANSIBLE_PLAYBOOK         ansible-playbook binary (default: ansible-playbook)
#   INVENTORY                inventory file    (default: ./inventory.ini)
set -Eeuo pipefail
cd "$(dirname "$0")"

INVENTORY="${INVENTORY:-inventory.ini}"
PROFILE="${PROFILE:-}"

# --- locate tools ----------------------------------------------------------
ANSIBLE="${ANSIBLE_PLAYBOOK:-}"
if [[ -z "$ANSIBLE" ]]; then
  if command -v ansible-playbook >/dev/null 2>&1; then ANSIBLE=ansible-playbook
  elif [[ -x "$HOME/.local/share/fcos-deploy-venv/bin/ansible-playbook" ]]; then
    ANSIBLE="$HOME/.local/share/fcos-deploy-venv/bin/ansible-playbook"
  else echo "ansible-playbook not found; set ANSIBLE_PLAYBOOK=" >&2; exit 1; fi
fi

BUTANE="${BUTANE:-}"
if [[ -z "$BUTANE" ]]; then
  # Resolve to an absolute path — the composer stats the file, 'butane' bare
  # would fail even when it's on PATH.
  if command -v butane >/dev/null 2>&1; then BUTANE="$(command -v butane)"
  elif [[ -x "$HOME/.local/bin/butane" ]]; then BUTANE="$HOME/.local/bin/butane"
  else echo "butane not found; install v0.23.0+ or set BUTANE=" >&2; exit 1; fi
fi
export BUTANE

# --- helpers ---------------------------------------------------------------
need_render_env() {
  : "${FCOS_SSH_PUBLIC_KEY:?set FCOS_SSH_PUBLIC_KEY to the core user pubkey}"
  : "${FCOS_CORE_PASSWORD_HASH:?set FCOS_CORE_PASSWORD_HASH (openssl passwd -6)}"
}

run_ansible() {
  local tags="$1"; shift
  local extra=()
  [[ -n "$PROFILE" ]] && extra+=(-e "@profiles/${PROFILE}.yml")
  "$ANSIBLE" -i "$INVENTORY" site.yml --tags "$tags" "${extra[@]}" "$@"
}

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

# --- commands ---------------------------------------------------------------
cmd="${1:-all}"
[[ $# -gt 0 ]] && shift
case "$cmd" in
  render)
    need_render_env
    run_ansible render "$@"
    ;;
  provision)
    need_render_env
    # provision depends on build/config.ign — render first if missing
    if [[ ! -f build/config.ign ]]; then
      echo ">> config.ign missing — rendering first"
      run_ansible render
    fi
    run_ansible provision "$@"
    ;;
  configure)
    run_ansible configure "$@"
    ;;
  all)
    need_render_env
    run_ansible render
    run_ansible provision
    run_ansible configure
    ;;
  clean)
    rm -rf build
    echo "Removed build/"
    ;;
  -h|--help|help) usage 0 ;;
  *) usage 1 ;;
esac
