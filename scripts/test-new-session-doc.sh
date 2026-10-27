#!/usr/bin/env bash
set -Eeuo pipefail

script="scripts/new-session-doc.sh"
test -s "$script"
bash -n "$script"
bash "$script" --help >/dev/null

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
mkdir -p "$tmpdir/scripts" "$tmpdir/docs"
cp "$script" "$tmpdir/scripts/new-session-doc.sh"
cd "$tmpdir"

# Feed the interactive fields and ensure the expected Markdown structure is generated.
printf '%s\n' \
  'ENG-123' \
  'Summary line' '.' \
  'Plan step 1' '.' \
  'Changed installer' '.' \
  'bash -n scripts/example.sh' '.' \
  'bash scripts/example.sh' '.' \
  | GIT_COMMIT=0123456789abcdef0123456789abcdef01234567 bash scripts/new-session-doc.sh 001 initialize

output='docs/sessions/session#001-initialize.md'
test -s "$output"
grep -q '^# session#001 - initialize$' "$output"
grep -q '^## 1. Summary$' "$output"
grep -q '^## 2. Plan$' "$output"
grep -q '^## 3. Changes$' "$output"
grep -q '^## 4. Validation steps$' "$output"
grep -q '^## 5. Commands$' "$output"
grep -q 'session#001 | 0123456789abcdef0123456789abcdef01234567' "$output"
grep -q 'ENG-123' "$output"

# Existing records must never be overwritten.
if GIT_COMMIT=0123456789abcdef0123456789abcdef01234567 bash scripts/new-session-doc.sh 001 initialize >/dev/null 2>&1; then
  echo 'Expected duplicate output file to be rejected' >&2
  exit 1
fi
printf 'PASS: syntax, generated sections, Linear link, commit metadata, and no-overwrite guard\n'
