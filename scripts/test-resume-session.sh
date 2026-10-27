#!/usr/bin/env bash
set -Eeuo pipefail

script="scripts/resume-session.sh"
test -s "$script"
bash -n "$script"
bash "$script" --help >/dev/null

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
mkdir -p "$tmpdir/scripts" "$tmpdir/.agents/sessions" "$tmpdir/docs/sessions"
cp "$script" "$tmpdir/scripts/resume-session.sh"
cd "$tmpdir"

git init -q
git config user.name "Session Resume Test"
git config user.email "session-resume-test@example.invalid"
printf 'initial\n' > README.md
git add README.md
git commit -qm "test fixture"

cat > .agents/sessions/HANDOFF.md <<'EOF'
# Handoff
- Linear issue: ENG-123
- [ ] Run validation
- [x] Inspect repository state

## Next actions
- [ ] Verify read-only behavior
EOF
cat > docs/sessions/session#001-test.md <<'EOF'
# session#001 - test
- Linear issue: https://linear.app/acme/issue/ENG-123
- [ ] Update test coverage
EOF
printf 'uncommitted change\n' >> README.md

output="$(bash scripts/resume-session.sh --linear ENG-123)"
grep -q 'Branch:' <<<"$output"
grep -q 'Worktree status:' <<<"$output"
grep -q 'README.md' <<<"$output"
grep -q 'Explicit reference: ENG-123' <<<"$output"
grep -q '=== Latest handoff ===' <<<"$output"
grep -q '=== Latest session record ===' <<<"$output"
grep -q 'Run validation' <<<"$output"
grep -q 'Verify read-only behavior' <<<"$output"
grep -q 'Read-only guarantee' <<<"$output"

# Without an explicit issue, references should be discovered from local Markdown.
output="$(bash scripts/resume-session.sh)"
grep -q 'ENG-123' <<<"$output"
printf 'PASS: syntax, branch/worktree report, Linear reference, handoff, session record, and outstanding actions\n'
