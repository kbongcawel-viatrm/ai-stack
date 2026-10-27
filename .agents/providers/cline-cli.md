# Cline CLI setup

## Requirements
- Supported Linux/macOS/Windows environment.
- Node.js 20+ per current install guide (Node.js 22 recommended); check official instructions for changes.
- npm and network access to npm registry.
- Configured provider/model and access credentials for the selected account.

## Install
Run `scripts/install-ai-tools.sh` from the repository root, or install only Cline with:

```bash
npm install --global cline
cline --version
cline --help
```

The installer does not run `cline auth` automatically because authentication is interactive and may use different providers.

## Authenticate
```bash
cline auth
```

For key-based provider auth, refer to the current `cline auth --help`. Typical pattern:

```bash
cline auth --provider anthropic --apikey "$ANTHROPIC_API_KEY" --modelid "<model-id>"
```

Use provider-specific model IDs and documented flags for the installed version. Interactive auth is preferred.

## Smoke test
```bash
cline --version
cline --help
cline -p "Inspect this repository and propose a plan. Do not modify files."
```

Verify exact flags with `cline --help` if installed version differs.

## Sources
- https://docs.cline.bot/getting-started/installing-cline
- https://docs.cline.bot/cli/cli-reference
- https://docs.cline.bot/getting-started/authorizing-with-cline
