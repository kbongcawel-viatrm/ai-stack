---
name: wrangler
description: Run or troubleshoot Wrangler CLI commands in projects that have a wrangler.jsonc, wrangler.json, or wrangler.toml file, including local development, Previews, deployment, and resource management.
---

# Wrangler CLI

Use this skill only when the project has `wrangler.jsonc`, `wrangler.json`, or `wrangler.toml`. Do not add Wrangler to projects with `cloudflare.config.ts` or no Cloudflare configuration.

## Inspect the Project

- Find the package manager, installed Wrangler version, package scripts, framework, and Wrangler config. Run commands through the project's scripts or package manager so they use its local version. Install dependencies using the existing lockfile when needed; do not silently upgrade Wrangler to match current docs. If the project has a Wrangler configuration file but Wrangler is not a dependency, follow the [installation guide](https://developers.cloudflare.com/workers/wrangler/install-and-update/index.md) to add it locally.
- Identify the config used by the build or deploy command, including framework-generated config. Edit its source rather than generated output.
- Establish the target account, Worker, environment, and resource before running commands that change them. For data operations, determine whether the target is local or remote.

## Retrieve What the Task Needs

Use the Cloudflare MCP `docs` tool if available, or fetch the relevant linked page directly. Follow links to the specific command or product involved; avoid loading the entire reference. If a page moves, rediscover it through the [Wrangler command index](https://developers.cloudflare.com/workers/wrangler/commands/index.md) or Cloudflare docs search.

| Task | Source |
| --- | --- |
| Discover commands and flags, including resource management, deployments, rollback, and diagnostics | Project-local `wrangler --help` and `wrangler <command> --help`; [command reference](https://developers.cloudflare.com/workers/wrangler/commands/index.md) |
| Edit config or add a binding | Installed `wrangler/config-schema.json` (usually under `node_modules`); [configuration reference](https://developers.cloudflare.com/workers/wrangler/configuration/index.md) |
| Deploy a framework application | [Framework guides](https://developers.cloudflare.com/workers/framework-guides/index.md); follow the guide for the project's existing framework and adapter |
| Migrate an application to Workers when requested | [Pages to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/index.md); [Vercel to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/vercel-to-workers/index.md) |
| Configure staging or production | [Environments](https://developers.cloudflare.com/workers/wrangler/environments/index.md) |
| Set secrets locally, in CI, or on a deployed Worker | [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/index.md) |
| Generate binding and runtime types | [TypeScript](https://developers.cloudflare.com/workers/languages/typescript/index.md) |
| Run locally or choose a testing approach | [Local development](https://developers.cloudflare.com/workers/local-development/index.md) |

## Deploy

Before deploying, ensure `wrangler.jsonc` specifies a `main` entry point (the Worker script) when deploying a Worker script alongside static assets. For static-assets-only Workers, `main` should point to a minimal script that returns `env.ASSETS.fetch(request)`.

Use `wrangler deploy --dry-run` where supported, with the intended config and environment. A successful dry run checks the build and packaging; it does not prove remote resources or runtime behavior work.

For deployment changes, use the project's build workflow and `wrangler deploy` where supported. Report what changed, the target environment, checks performed, and any unresolved validation gaps. Link the documentation used when the result depends on current command or configuration behavior.