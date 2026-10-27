#!/usr/bin/env bash
set -Eeuo pipefail
script="scripts/install-ai-tools.sh"
test -s "$script"
bash -n "$script"
# Guardrails and expected nvm/Node/npm workflow.
grep -q 'nvm install --lts' "$script"
grep -q 'nvm use --lts' "$script"
grep -q "nvm alias default 'lts/\*'" "$script"
grep -q 'npm install --global cline' "$script"
grep -q 'INSTALL_LINEAR_CLI' "$script"
grep -q 'No credentials were requested' "$script"

# Exercise the installer with a fake nvm and fake binaries; do not install anything.
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
mkdir -p "$tmpdir/home/.nvm" "$tmpdir/bin"
export NVM_TEST_LOG="$tmpdir/nvm-calls.log"
cat > "$tmpdir/home/.nvm/nvm.sh" <<'NVM_MOCK'
nvm() {
  printf '%s\n' "$*" >> "$NVM_TEST_LOG"
  case "$1 $2" in
    "install --lts"|"use --lts"|"alias default") return 0 ;;
    *) return 1 ;;
  esac
}
NVM_MOCK
cat > "$tmpdir/bin/node" <<'NODE_MOCK'
#!/usr/bin/env bash
if [[ "${1:-}" == "-p" ]]; then printf '22\n'; else printf 'v22.16.0\n'; fi
NODE_MOCK
cat > "$tmpdir/bin/npm" <<'NPM_MOCK'
#!/usr/bin/env bash
printf '11.0.0\n' >&2
printf '%s\n' "$*" >> "$NVM_TEST_LOG"
NPM_MOCK
cat > "$tmpdir/bin/cline" <<'CLINE_MOCK'
#!/usr/bin/env bash
printf 'cline test version\n'
CLINE_MOCK
chmod +x "$tmpdir/bin/node" "$tmpdir/bin/npm" "$tmpdir/bin/cline"
HOME="$tmpdir/home" NVM_DIR="$tmpdir/home/.nvm" PATH="$tmpdir/bin:/usr/bin:/bin" \
  bash "$script" > "$tmpdir/output" 2>&1
grep -q '^install --lts$' "$NVM_TEST_LOG"
grep -q '^use --lts$' "$NVM_TEST_LOG"
grep -q "^alias default lts/\*$" "$NVM_TEST_LOG"
grep -q '^install --global cline$' "$NVM_TEST_LOG"
grep -q 'Active Node.js: v22.16.0' "$tmpdir/output"
grep -q 'Done. No credentials were requested' "$tmpdir/output"
printf 'PASS: syntax, nvm LTS install/use, npm/CLI flow, and mocked installer test\n'
