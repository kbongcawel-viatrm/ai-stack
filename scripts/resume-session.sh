#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/resume-session.sh [--linear ISSUE_ID_OR_URL]

Read-only session-resume report. It prints the current Git branch/worktree,
the newest local handoff and session record, Linear references found in those
records, and unchecked Markdown checklist items.

Options:
  --linear REF  Explicitly identify the relevant Linear issue/session.
  -h, --help    Show this help.

This script does not contact Linear, modify files, stage changes, or run Git
mutations. Linear references are discovered from local Markdown or supplied
explicitly; use the read-only Linear MCP connection to fetch current issue data.
USAGE
}

linear_ref=""
while (($#)); do
  case "$1" in
    --linear)
      (($# >= 2)) || { echo "[error] --linear requires an issue ID or URL." >&2; exit 2; }
      linear_ref="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[error] Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

command -v git >/dev/null 2>&1 || { echo "[error] git is required." >&2; exit 1; }
repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "[error] Run this script from inside the ai-stack Git repository." >&2
  exit 1
}
cd "$repo_root"

latest_file() {
  local kind="$1"
  local roots=()
  [[ -d .agents/sessions ]] && roots+=(.agents/sessions)
  [[ -d docs/sessions ]] && roots+=(docs/sessions)
  (("${#roots[@]}")) || return 0

  case "$kind" in
    handoff)
      find "${roots[@]}" -type f -iname '*handoff*.md' ! -path '*/templates/*' -print0 2>/dev/null |
        xargs -0 -r stat --printf='%Y\t%n\n' 2>/dev/null |
        sort -nr | head -n 1 | cut -f2-
      ;;
    session)
      find "${roots[@]}" -type f -iname 'session*.md' ! -path '*/templates/*' -print0 2>/dev/null |
        xargs -0 -r stat --printf='%Y\t%n\n' 2>/dev/null |
        sort -nr | head -n 1 | cut -f2-
      ;;
  esac
}

latest_handoff="$(latest_file handoff)"
latest_session="$(latest_file session)"
status_file_list=()
[[ -n "$latest_handoff" ]] && status_file_list+=("$latest_handoff")
[[ -n "$latest_session" && "$latest_session" != "$latest_handoff" ]] && status_file_list+=("$latest_session")

printf '%s\n' '=== Repository state (read-only) ==='
printf 'Repository: %s\n' "$repo_root"
printf 'Branch:     %s\n' "$(git branch --show-current)"
printf 'HEAD:       %s\n' "$(git rev-parse HEAD)"
printf '\nWorktree status:\n'
git status --short --branch
printf '\nLatest commit:\n'
git log -1 --date=iso-strict --format='  %h %ad %s'

printf '\n%s\n' '=== Relevant Linear session ==='
if [[ -n "$linear_ref" ]]; then
  printf 'Explicit reference: %s\n' "$linear_ref"
else
  found_refs=""
  if (("${#status_file_list[@]}")); then
    found_refs="$(grep -hEo 'https?://linear\.app/[^[:space:])>]+' "${status_file_list[@]}" 2>/dev/null || true)"
    found_ids="$(grep -hEo '\b[A-Z][A-Z0-9]{1,9}-[0-9]+\b' "${status_file_list[@]}" 2>/dev/null || true)"
    found_refs="$(printf '%s\n%s\n' "$found_refs" "$found_ids" | sed '/^[[:space:]]*$/d' | sort -u)"
  fi
  if [[ -n "$found_refs" ]]; then
    printf '%s\n' "$found_refs"
  else
    printf '%s\n' 'No Linear issue ID/URL found in the latest local handoff/session record.'
    printf '%s\n' 'Pass --linear ISSUE-ID_OR_URL to label the relevant session; current Linear data is not fetched by this script.'
  fi
fi

printf '\n%s\n' '=== Latest handoff ==='
if [[ -n "$latest_handoff" && -f "$latest_handoff" ]]; then
  printf 'Source: %s\n\n' "$latest_handoff"
  cat -- "$latest_handoff"
else
  printf '%s\n' 'No actual handoff Markdown file found (templates are intentionally excluded).'
  if [[ -f .agents/sessions/templates/HANDOFF.md ]]; then
    printf '%s\n' 'Template available: .agents/sessions/templates/HANDOFF.md'
  fi
fi

printf '\n%s\n' '=== Latest session record ==='
if [[ -n "$latest_session" && -f "$latest_session" ]]; then
  printf 'Source: %s\n' "$latest_session"
  sed -n '1,160p' "$latest_session"
else
  printf '%s\n' 'No standalone session record found under .agents/sessions or docs/sessions.'
  printf '%s\n' 'If the session is documented only in Linear or README.md, consult that source directly.'
fi

printf '\n%s\n' '=== Outstanding checklist actions ==='
if (("${#status_file_list[@]}")); then
  matches="$(grep -HnE '^[[:space:]]*[-*][[:space:]]+\[[[:space:]]\][[:space:]]+' "${status_file_list[@]}" 2>/dev/null || true)"
  if [[ -n "$matches" ]]; then
    printf '%s\n' "$matches"
  else
    printf '%s\n' 'No unchecked Markdown checklist items found in the latest handoff/session record.'
  fi
else
  printf '%s\n' 'No handoff/session files were available to scan for checklist actions.'
fi

printf '\n%s\n' 'Read-only guarantee: no files or Git refs were changed; no Linear API request was made.'
