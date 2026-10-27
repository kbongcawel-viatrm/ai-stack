# Modular AI stack

A provider/model-modular AI development workflow. GitHub stores code and curated shared agent context; Cline is the primary terminal/IDE coding agent; provider credentials stay local or in secret management; Linear tracks planning, decisions, and work handoffs.

## Architecture
1. **Provider/API:** Cline API, Anthropic, OpenAI, AWS Bedrock, OpenRouter, or local Ollama. Select based on capability, cost, privacy, and runtime requirements.
2. **Agent runtime:** Cline CLI and/or IDE extension; configure authentication separately.
3. **Shared context:** `.agents/` contains portable rules, curated memory, reusable skills, provider docs, and session templates. `.clinerules/` and `.cline/` provide Cline-specific project entry points.
4. **Planning:** Linear issues capture goals, acceptance criteria, decisions, blockers, and handoffs. Linear MCP is the recommended agent integration.
5. **Source control:** GitHub holds code and reviewed context and tracks changes via commits and pull requests.

## Quick start

### Install Cline CLI
Prerequisite: supported Node.js LTS (20+; current guide recommends Node.js 22) and npm.

```bash
./scripts/install-ai-tools.sh
cline --version
cline auth
```

The installer only installs tools; it does not authenticate or create credentials.

### Configure a provider
Read [Cline CLI setup](.agents/providers/cline-cli.md) and [Cline API setup](.agents/providers/cline-api.md). The Cline API is at `https://api.cline.bot/api/v1`; it is not a separate CLI package. Create API keys in the official account and keep them outside Git. Other providers require their own supported model IDs and auth.

`.env.example` documents variable names only. A local `.env` is ignored; never commit credentials.

### Linear
Use Linear's official MCP endpoint `https://mcp.linear.app/mcp` with the compatible client's authenticated MCP setup. See [workflow](docs/linear-planning.md) and [provider notes](.agents/providers/linear.md). An optional third-party CLI is documented there; it is not required for Linear MCP:

```bash
INSTALL_LINEAR_CLI=1 ./scripts/install-ai-tools.sh
```

Review package provenance and workflow side effects before adoption.

### Plan and hand off
Create/update a Linear issue with a goal and acceptance criteria. Use `.agents/sessions/templates/SESSION_PLAN.md` for planning and `HANDOFF.md` for cross-device handoff. Commit only durable, non-sensitive memory. See [repository layout](docs/repository-layout.md).

## Structure
```text
.agents/       portable rules, memory, provider docs, skills, session templates
.clinerules/   Cline project rules
.cline/        Cline-specific extension points
docs/          architecture and workflow documentation
scripts/       repeatable setup and static validation
.github/       CI validation and pull-request template
```

## Workflow
1. Read working agreement and relevant skill/memory.
2. Plan non-trivial work in Linear.
3. Implement the smallest coherent change on a branch.
4. Test and review; update handoff/memory when durable context changes.
5. Open a PR with validation results and link the Linear issue.
6. Merge after review/checks. Never store raw transcripts, credentials, or sensitive production data in repository memory.

## Validation
```bash
bash -n scripts/install-ai-tools.sh scripts/test-install-ai-tools.sh
bash scripts/test-install-ai-tools.sh
git status --short
```

## References
- https://docs.cline.bot/getting-started/installing-cline
- https://docs.cline.bot/cli/cli-reference
- https://docs.cline.bot/api/overview
- https://docs.cline.bot/api/authentication
- https://linear.app/docs/mcp

## Diagram
[Architecture diagram](https://excalidraw.com/#json=FHASE2MuEnxo-PBys7TUO,pwDQ6odBoOZ_RUu4iaoA4A)
