#!/usr/bin/env bash
set -euo pipefail

PAYLOAD=$(cat)
COMMAND=$(echo "$PAYLOAD" | jq -r '.tool_input.command // empty')

# Only intercept git commit commands
if [[ "$COMMAND" != *"git commit"* ]]; then
  exit 0
fi

ROOT="${DEVIN_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$ROOT"

block() {
  jq -n --arg r "$1" '{decision:"block", reason:$r}'
  exit 0
}

SCAN_DIRS=()
for d in projects scripts; do [[ -e "$d" ]] && SCAN_DIRS+=("$d"); done

# 1. Safety (Python) scan
if command -v safety >/dev/null 2>&1; then
  if [[ ${#SCAN_DIRS[@]} -gt 0 ]]; then
    if ! safety scan "${SCAN_DIRS[@]}" >/tmp/safety-out.txt 2>&1; then
      block "Safety scan failed. Fix the reported security findings before committing. Logs in /tmp/safety-out.txt"
    fi
  fi
else
  echo "pre-commit-security: safety not installed, skipping scan" >&2
fi

# 2. Snyk scan
if command -v snyk >/dev/null 2>&1; then
  if [[ ${#SCAN_DIRS[@]} -gt 0 ]]; then
    if ! snyk test --all-projects --org=99aa9ed1-3e50-435f-9876-9b07cb97400b "${SCAN_DIRS[@]}" >/tmp/snyk-out.txt 2>&1; then
      block "Snyk scan failed. Fix the reported security findings before committing. Logs in /tmp/snyk-out.txt"
    fi
  fi
else
  echo "pre-commit-security: snyk not installed, skipping scan" >&2
fi

# All enabled checks passed; allow git commit to run
echo "pre-commit-security: all checks passed" >&2
exit 0
