#!/usr/bin/env bash
set -Eeuo pipefail
# Installs nvm, the latest Node.js LTS (including its bundled npm), Cline CLI,
# and optionally a community Linear CLI. Does not create keys or log in.
# Usage: ./scripts/install-ai-tools.sh
# Optional: INSTALL_LINEAR_CLI=1 ./scripts/install-ai-tools.sh
# Optional: INSTALL_CLINE=0 INSTALL_LINEAR_CLI=1 ./scripts/install-ai-tools.sh
# Optional: NVM_VERSION=v0.40.8 ./scripts/install-ai-tools.sh
log() { printf '[setup] %s\n' "$*"; }
die() { printf '[error] %s\n' "$*" >&2; exit 1; }
command_exists() { command -v "$1" >/dev/null 2>&1; }

INSTALL_CLINE="${INSTALL_CLINE:-1}"
INSTALL_LINEAR_CLI="${INSTALL_LINEAR_CLI:-0}"
NVM_VERSION="${NVM_VERSION:-v0.40.8}"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[[ "$INSTALL_CLINE" =~ ^[01]$ ]] || die 'INSTALL_CLINE must be 0 or 1'
[[ "$INSTALL_LINEAR_CLI" =~ ^[01]$ ]] || die 'INSTALL_LINEAR_CLI must be 0 or 1'
[[ "$NVM_VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die 'NVM_VERSION must look like v0.40.8'
if [[ "$INSTALL_CLINE" == 0 && "$INSTALL_LINEAR_CLI" == 0 ]]; then die 'Nothing selected.'; fi

if [[ "$INSTALL_CLINE" == 1 || "$INSTALL_LINEAR_CLI" == 1 ]]; then
  if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    command_exists curl || command_exists wget || die 'curl or wget is required to install nvm.'
    log "Installing nvm $NVM_VERSION for the current user..."
    installer="$(mktemp)"
    trap 'rm -f "$installer"' EXIT
    installer_url="https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh"
    if command_exists curl; then
      curl --fail --silent --show-error --location "$installer_url" --output "$installer" || die 'Could not download the pinned nvm installer.'
    else
      wget --https-only --quiet "$installer_url" --output-document="$installer" || die 'Could not download the pinned nvm installer.'
    fi
    bash "$installer" || die 'nvm installation failed.'
    rm -f "$installer"
    trap - EXIT
  fi

  [[ -s "$NVM_DIR/nvm.sh" ]] || die "nvm.sh was not found at $NVM_DIR/nvm.sh after installation."
  # nvm is a shell function and must be sourced into this process.
  # shellcheck disable=SC1090
  source "$NVM_DIR/nvm.sh"
  declare -F nvm >/dev/null || die 'nvm could not be loaded into this shell.'

  log 'Installing and activating the latest Node.js LTS release (npm is bundled with Node.js)...'
  nvm install --lts
  nvm use --lts
  nvm alias default 'lts/*'
  command_exists node || die 'Node.js is not on PATH after nvm use --lts.'
  command_exists npm || die 'npm is not on PATH after nvm use --lts.'
  log "Active Node.js: $(node --version)"
  log "Active npm: $(npm --version)"
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
