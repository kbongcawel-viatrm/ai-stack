#!/usr/bin/env bash
set -Eeuo pipefail
script="scripts/install-ai-tools.sh"
test -s "$script"
bash -n "$script"
# Guardrails and expected package names.
grep -q 'npm install --global cline' "$script"
grep -q 'INSTALL_LINEAR_CLI' "$script"
grep -q 'Node.js 20+' "$script"
grep -q 'No credentials were requested' "$script"
# Simulate missing Node without performing installs; it must fail cleanly.
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
if PATH="$tmpdir" /bin/bash "$script" >"$tmpdir/out" 2>&1; then
  echo 'Expected missing-Node guard to fail' >&2
  exit 1
fi
grep -q 'Node.js 20+ is required' "$tmpdir/out"
printf 'PASS: syntax, installer guards, and missing-Node negative test\n'
