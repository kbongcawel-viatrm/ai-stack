#!/usr/bin/env bash
set -euo pipefail

PAYLOAD=$(cat)
COMMAND=$(echo "$PAYLOAD" | jq -r '.tool_input.command // empty')

# Only intercept workspace-push (the deploy trigger); let everything else through
if [[ "$COMMAND" != *"workspace-push"* ]]; then
  exit 0
fi

# Resolve the repo the push targets: an explicit projects/<name> in the
# command wins (workspace-push is normally run after `cd projects/<name>`),
# then the command's cwd if inside a git worktree, else DEVIN_PROJECT_DIR.
WS_ROOT="${DEVIN_PROJECT_DIR:-$(pwd)}"
if [[ "$WS_ROOT" != */projects/* ]]; then
  PROJ=$(printf '%s' "$COMMAND" | grep -oE 'projects/[a-zA-Z0-9._-]+' | head -1 || true)
  [[ -n "$PROJ" && -d "$WS_ROOT/$PROJ" ]] && WS_ROOT="$WS_ROOT/$PROJ"
fi
ROOT="$WS_ROOT"
if ROOT_DIR=$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null); then
  ROOT="$ROOT_DIR"
fi
cd "$ROOT"

block() {
  jq -n --arg r "$1" '{decision:"block", reason:$r}'
  exit 0
}

VALIDATE="$ROOT/scripts/workspace-validate.sh"
if [[ ! -x "$VALIDATE" ]]; then
  echo "pre-deploy-build: no scripts/workspace-validate.sh in $ROOT, skipping" >&2
  exit 0
fi

# workspace-validate covers npm test, typecheck, build and wrangler --dry-run.
if ! VALIDATE_OUT=$(bash "$VALIDATE" 2>&1); then
  block "workspace-validate failed — deployment blocked. Fix and retry.\n$(printf '%s' "$VALIDATE_OUT" | tail -40)"
fi

echo "pre-deploy-build: validation passed" >&2
exit 0
