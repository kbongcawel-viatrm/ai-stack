# Cline API setup

Cline API is an authenticated OpenAI-compatible Chat Completions API. It is distinct from the Cline CLI: install the CLI with npm, and create API keys separately in the Cline account.

## Create a key
1. Sign in at https://app.cline.bot/.
2. Open **Settings → API Keys**, create a key, and copy it when shown.
3. Store it in a secret manager or local environment. Do not commit it or paste it into Linear.
4. Export it for the current shell: `export CLINE_API_KEY='...'`. Avoid putting secrets in shell history; prefer a secret manager's shell integration.

## Request endpoint
- Base URL: `https://api.cline.bot/api/v1`
- Chat Completions: `POST /chat/completions`
- Authentication: `Authorization: Bearer $CLINE_API_KEY`
- Model: select an exact model ID shown as available to your account; the example below is illustrative, not a guarantee that it is enabled.

## Smoke test
Requires `curl` and `jq`. Do not enable shell tracing with `set -x` while secrets are in the environment.

```bash
set -euo pipefail
: "${CLINE_API_KEY:?Export CLINE_API_KEY before testing}"
MODEL_ID="${CLINE_API_MODEL:-anthropic/claude-sonnet-4-6}"
response_file="$(mktemp)"
trap 'rm -f "$response_file"' EXIT
http_code="$(curl --silent --show-error --output "$response_file" --write-out '%{http_code}' --request POST 'https://api.cline.bot/api/v1/chat/completions' --header "Authorization: Bearer ${CLINE_API_KEY}" --header 'Content-Type: application/json' --data "$(jq -n --arg model "$MODEL_ID" '{model:$model,messages:[{role:"user",content:"Reply with the single word: OK"}]}')")"
if [[ "$http_code" != 2* ]]; then
  printf 'Cline API request failed (HTTP %s). Response body omitted to avoid leaking details.\n' "$http_code" >&2
  exit 1
fi
jq -e '.choices[0].message.content' "$response_file" >/dev/null
printf 'Cline API smoke test succeeded (HTTP %s).\n' "$http_code"
```

Do not print the response body by default. Review provider usage, model access, data handling, and billing before production use.

## Sources
- https://docs.cline.bot/api/overview
- https://docs.cline.bot/api/getting-started
- https://docs.cline.bot/api/authentication
