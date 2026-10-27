#!/usr/bin/env bash
set -Eeuo pipefail
# Installs Cline CLI and optionally a community Linear CLI. Does not create keys or log in.
# Usage: ./scripts/install-ai-tools.sh
# Optional: INSTALL_LINEAR_CLI=1 ./scripts/install-ai-tools.sh
# Optional: INSTALL_CLINE=0 INSTALL_LINEAR_CLI=1 ./scripts/install-ai-tools.sh
log() { printf '[setup] %s\n' "$*"; }
die() { printf '[error] %s\n' "$*" >&2; exit 1; }
command_exists() { command -v "$1" >/dev/null 2>&1; }
INSTALL_CLINE="${INSTALL_CLINE:-1}"
INSTALL_LINEAR_CLI="${INSTALL_LINEAR_CLI:-0}"
[[ "$INSTALL_CLINE" =~ ^[01]$ ]] || die 'INSTALL_CLINE must be 0 or 1'
[[ "$INSTALL_LINEAR_CLI" =~ ^[01]$ ]] || die 'INSTALL_LINEAR_CLI must be 0 or 1'
if [[ "$INSTALL_CLINE" == 0 && "$INSTALL_LINEAR_CLI" == 0 ]]; then die 'Nothing selected.'; fi
if [[ "$INSTALL_CLINE" == 1 || "$INSTALL_LINEAR_CLI" == 1 ]]; then
  command_exists node || die 'Node.js 20+ is required (22 recommended by the current Cline guide).'
  command_exists npm || die 'npm was not found.'
  node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
  (( node_major >= 20 )) || die "Node.js 20+ required; detected $(node --version)."
fi
if [[ "$INSTALL_CLINE" == 1 ]]; then
  log 'Installing/updating Cline CLI from npm...'
  npm install --global cline
  command_exists cline || die 'Cline installed but cline is not on PATH.'
  cline --version
  log 'Authenticate separately with: cline auth'
fi
if [[ "$INSTALL_LINEAR_CLI" == 1 ]]; then
  log 'Installing optional community Linear CLI (@humanintheloop/linear)...'
  npm install --global @humanintheloop/linear
  command_exists linear || die 'Linear CLI installed but linear is not on PATH.'
  linear --version
  log 'Review package docs, then authenticate with: linear auth login'
fi
log 'Done. No credentials were requested or written by this installer.'
