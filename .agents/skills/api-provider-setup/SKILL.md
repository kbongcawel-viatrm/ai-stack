---
name: api-provider-setup
description: Configure or change an AI model provider while keeping provider credentials out of source control.
---

# API provider setup

1. Identify whether configuring Cline CLI, Cline IDE, or an application calling Cline API.
2. Verify provider, endpoint, model ID, auth method, region/profile, and account access against official docs.
3. Create credentials in the provider console. Prefer a secret manager, environment variable, or interactive auth UI. Never put a real secret in Git, `.env.example`, Linear, screenshots, or logs.
4. For Cline CLI, use `cline auth` or the installed version's documented key-based flags.
5. For Cline API, create a key through Cline account settings and call `https://api.cline.bot/api/v1/chat/completions` using `Authorization: Bearer $CLINE_API_KEY`.
6. Run a small, non-sensitive smoke test; verify success, model selection, latency, usage cost, and data handling.
7. Document non-secret settings, source links, limitations, and verification date in `.agents/memory/`.
8. Review `git status --short` and scan staged changes for secrets before committing.

- [ ] Endpoint/model IDs verified from official docs
- [ ] Correct credential source and minimum permissions selected
- [ ] Credentials remain untracked and unprinted
- [ ] Smoke test passes
- [ ] Cost/region/data handling understood
