---
name: api-provider-setup
description: Configure, test, or change an AI model provider for this repository while keeping provider credentials out of source control.
---

# API provider setup

## Purpose
Configure an AI provider/model for Cline or an OpenAI-compatible client in a repeatable, secret-safe way.

## Steps
1. Confirm which client is being configured: Cline CLI, Cline IDE extension, or an application calling the Cline API.
2. Confirm provider, endpoint/base URL, model ID, authentication scheme, and any region/profile requirement from official documentation.
3. Create credentials in the provider's official console. Prefer an environment variable, local secret manager, or client auth UI; never put a real secret in Git, a committed `.env.example`, Linear, screenshots, or logs.
4. For Cline CLI, use `cline auth` for interactive setup or `cline auth --provider <provider> --apikey "$KEY" --modelid <model>` for a supported key-based provider. Check `cline auth --help` for the installed version.
5. For the Cline API, create a Cline API key under account settings and call `https://api.cline.bot/api/v1/chat/completions` with `Authorization: Bearer $CLINE_API_KEY`. The model ID must be available to the account/API.
6. Run a small, non-sensitive smoke test. Confirm success, model selection, latency, and usage cost before using the provider for larger tasks.
7. Document only non-secret configuration, source links, limitations, and verification date in `.agents/memory/`.
8. Verify `git status --short` and scan staged changes for secrets before committing.

## Provider switching checklist
- [ ] Endpoint and model IDs verified from official docs
- [ ] Correct credential source and minimum permissions selected
- [ ] Credentials are untracked and never printed
- [ ] Smoke test passes
- [ ] Cost/region/data-handling requirements understood
- [ ] Shared documentation updated without secrets
