#!/usr/bin/env bash
set -Eeuo pipefail

# Create a Markdown session record that links back to the authoritative Linear issue.
# Usage: scripts/new-session-doc.sh [session-number] [slug]
# Example: scripts/new-session-doc.sh 001 initialize
# Multiline prompts end when a line containing only "." is entered.

die() { printf '[error] %s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'USAGE'
Usage: scripts/new-session-doc.sh [session-number] [slug]

Example:
  scripts/new-session-doc.sh 001 initialize

Creates docs/sessions/session#001-initialize.md.
Enter each multiline section line by line; enter a single "." to finish it.
Linear remains the authoritative progress/memory record; this file is a portable Git-linked summary.
USAGE
}

[[ "${1:-}" != "-h" && "${1:-}" != "--help" ]] || { usage; exit 0; }
[[ $# -le 2 ]] || { usage >&2; exit 2; }

session_number="${1:-}"
slug="${2:-}"

if [[ -z "$session_number" ]]; then
  read -r -p 'Session number (e.g. 001): ' session_number
fi
[[ "$session_number" =~ ^[0-9]{3,}$ ]] || die 'Session number must be at least three digits (e.g. 001).'

if [[ -z "$slug" ]]; then
  read -r -p 'Short title/slug (e.g. initialize): ' slug
fi
[[ -n "$slug" ]] || die 'A title/slug is required.'
slug="$(printf '%s' "$slug" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
[[ -n "$slug" ]] || die 'Title/slug must contain at least one letter or digit.'

output_dir="docs/sessions"
output_file="$output_dir/session#$session_number-$slug.md"
[[ ! -e "$output_file" ]] || die "File already exists: $output_file"

today="$(date +%F)"
current_commit='not recorded'
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  current_commit="$(git rev-parse HEAD)"
fi
commit_hash="${GIT_COMMIT:-$current_commit}"

printf '\nDate: %s\n' "$today"
printf 'Session ID: session#%s\n' "$session_number"
printf 'Current/default commit: %s\n' "$commit_hash"
printf 'Note: if this record is created before its implementation commit, replace the commit hash with the actual final commit after it exists.\n\n'

read -r -p 'Linear issue ID or URL (or "not created yet"): ' linear_issue
linear_issue="${linear_issue:-not recorded}"

read_block() {
  local label="$1"
  local line
  local result=''
  printf '%s (enter "." on a line by itself to finish):\n' "$label" >&2
  while IFS= read -r line; do
    [[ "$line" == "." ]] && break
    if [[ -n "$result" ]]; then result+=$'\n'; fi
    result+="$line"
  done
  REPLY="$result"
}

read_block '1. Summary'
summary="$REPLY"
read_block '2. Plan'
plan="$REPLY"
read_block '3. Changes'
changes="$REPLY"
read_block '4. Validation steps'
validation="$REPLY"
read_block '5. Commands'
commands="$REPLY"

[[ -n "$summary" ]] || die 'Summary cannot be empty.'
[[ -n "$plan" ]] || die 'Plan cannot be empty.'

mkdir -p "$output_dir"
tmp_file="$(mktemp "$output_dir/.session-doc.XXXXXX")"
trap 'rm -f "$tmp_file"' EXIT

cat > "$tmp_file" <<EOF
# session#$session_number - $slug

## 0. Date

$today

- **Linear issue:** $linear_issue
- **Status:** draft; update after validation and final commit
- **Memory source:** Linear is the authoritative record for session progress, decisions, blockers, and handoffs. This file is a concise Git-linked snapshot.

## 1. Summary

$summary

## 2. Plan

$plan

## 3. Changes

${changes:-Not recorded yet.}

## 4. Validation steps

${validation:-Not run or not recorded yet.}

## 5. Commands

```text
${commands:-Not recorded yet.}
```

## 6. Session and commit

- `session#$session_number | $commit_hash`

> Verify the full commit hash after committing. If this document is included in the implementation commit, update the hash in a follow-up commit to avoid a self-referential commit record.
EOF

mv "$tmp_file" "$output_file"
trap - EXIT
printf '[success] Created %s\n' "$output_file"
printf '[next] Update the Linear issue with this file link, validation evidence, and the final commit SHA.\n'
