# Cline CLI setup

## Requirements
- Supported Linux/macOS/Windows environment (nvm-sh is for POSIX shells and WSL; use the Windows-specific NVM implementation on native Windows).
- `curl` or `wget` to bootstrap nvm if it is not installed.
- Git/network access to the official nvm and Node.js distribution sources.
- Configured provider/model and access credentials for the selected account.

## Install with nvm

Run the installer from the repository root:

```bash
./scripts/install-ai-tools.sh
```

The script bootstraps the pinned nvm release `v0.40.8` when needed, sources nvm into the current process, then runs:

```bash
nvm install --lts
nvm use --lts
nvm alias default 'lts/*'
node --version
npm --version
```

This installs the latest available Node.js Long-Term Support release and uses the npm version bundled with that Node.js release. It does not select the non-LTS Current release. Re-run the installer to refresh the active LTS and reinstall/update Cline CLI under that Node.js version. Global npm packages are scoped to each nvm-managed Node.js version, so they may need reinstalling when you switch versions.

The installer does not use system package managers or `sudo` to install Node.js. It does not automatically migrate packages from an existing system Node.js installation.

If nvm is already installed in a non-default directory, set `NVM_DIR` to that directory. To override the pinned nvm release after reviewing its official release, set `NVM_VERSION`.

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
node --version
npm --version
nvm current
cline --version
cline --help
cline -p "Inspect this repository and propose a plan. Do not modify files."
```

Verify exact flags with `cline --help` if the installed version differs.

## Sources
- https://github.com/nvm-sh/nvm/releases/tag/v0.40.8
- https://github.com/nvm-sh/nvm#long-term-support
- https://nodejs.org/en/about/previous-releases
- https://docs.cline.bot/getting-started/installing-cline
- https://docs.cline.bot/cli/cli-reference
- https://docs.cline.bot/getting-started/authorizing-with-cline
