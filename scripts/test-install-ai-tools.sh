#!/usr/bin/env bash
set -Eeuo pipefail
script="scripts/install-ai-tools.sh"
test -s "$script"
bash -n "$script"
grep -q 'npm install --global cline' "$script"
grep -q 'INSTALL_LINEAR_CLI' "$script"
grep -q 'Node.js 20+' "$script"
grep -q 'No credentials were requested' "$script"
printf 'PASS: installer syntax and expected safety/install guards\n'
