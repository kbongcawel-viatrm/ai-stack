# Session plan: centralized agent config — MCP, skills, sessions, memory

- Date: 2026-11-13
- Linear issue: not created yet
- Branch: decided on `mistral-central-auth-authentication` @ 21f0638; implementation should land per the branch policy in `AGENTS.md` (devin) unless the user overrides
- Owner: kim (with Cline)
- Status: planned — design converged, implementation not started

## Goal

Any AI agent/provider/model (Cline, Claude Code, Cursor, Gemini, aider, Copilot, Devin, ...) working in this repository gets its MCP servers, skills, rules, session protocol, and memory from one canonical place — `.agents/` — with no duplicated skill trees or rule files to drift.

## Context

- Canonical hub already exists: `.agents/` (rules, skills, sources, providers, memory, sessions) plus `scripts/resume-session.sh`, `new-session-doc.sh`, `collect-session-forensics.sh`, and `skills-lock.json` for hash-pinned external skills.
- **Decision (2026-11-13, user): no per-agent mirrors.** Agents are pointed at `.agents/` via their entry-point files; skills are NOT copied into `.cline/skills/`, `.claude/skills/`, etc. Trade-off accepted: agents that ignore instructions lose native skill discovery.
- Drift evidence that motivated this: `.cline/skills/` already differs from `.agents/skills/` (`bash-scripting/SKILL.md` content differs; ≥4 skills exist only in `.agents/`); `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules` are byte-identical copies that omit rules present in `AGENTS.md` (devin-branch rule, jikida rule).
- **MCP is the one exception to "no mirrors":** each agent reads its own native config format at startup and cannot be "pointed" at a registry. Model: canonical registry + per-agent native config files, kept conformant by validation (not generation).
- MCP servers in use: jikida (stdio, token in global Cline settings outside git), github (remote, OAuth, readonly variant used in project), cloudflare (remote, OAuth), google-cloud (stdio bridge `~/.cline/mcp-bridges/gcp-mcp-bridge.mjs` injecting Google credentials).
- CentralAuth (Next.js app, in progress on `mistral-central-auth-authentication`) is the future credential resolver; the registry's auth-strategy field is its integration point.

## Design

1. `.agents/mcp/registry.json` — canonical MCP declaration: name, transport, endpoint/command, auth strategy (`oauth` | `token-ref:<ENV_VAR>` | `bridge`), scope (project/global), readonly flag. No secrets, ever.
2. Per-agent native MCP configs (`.cline/mcp.json`, Claude Code `.mcp.json`, etc.) stay hand-maintained but must conform to the registry; a validation script checks conformance and fails on drift/secrets.
3. Entry points become thin pointers: `AGENTS.md` is canonical; `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md` are one-line pointers to it; `.clinerules/00-project.md` keeps pointing at the working agreement.
4. Skills: `.agents/skills/` is the only skill tree; migrate jikida (currently only in `.claude/skills/`) into it; then remove duplicate trees (`.cline/skills/`, `.claude/skills/`) — tracked deletions, need explicit approval.
5. Sessions: handoff via `.agents/sessions/templates/HANDOFF.md` becomes mandatory for non-trivial sessions with a non-empty Linear issue field.
6. Memory: consolidate under `.agents/memory/` (absorb root `memory-security.md` as `security.md`, update jikida skill reference); private notes stay in gitignored `.agents/memory/local/`.

## Acceptance criteria

- [ ] Every MCP server used by any agent is declared exactly once in `.agents/mcp/registry.json` with an auth strategy and no secret material.
- [ ] Per-agent MCP configs contain no secrets (gitleaks clean) and match the registry; `scripts/validate-agent-config.sh` fails on drift.
- [ ] `.agents/skills/` is the only skill tree in the repo; duplicate trees removed after migration; entry-point files instruct agents to load skills from it.
- [ ] All five agent entry-point files resolve to the same rules (AGENTS.md canonical, others point at it); no rule exists in only one copy.
- [ ] Every non-trivial session leaves a handoff in `.agents/sessions/` with a Linear issue reference; `resume-session.sh` surfaces it.
- [ ] One memory tree; jikida memory path updated; no secrets (enforced by gitleaks in CI).
- [ ] Adding a new agent/provider requires only: one entry-point pointer + one native MCP config entry + one registry row.

## Plan

1. ~~Inspect~~ done — drift evidence captured above (2026-11-13).
2. Implement: registry.json → entry-point consolidation → jikida skill migration → duplicate-tree removal (with approval) → memory consolidation → validate script + CI wiring.
3. Validate: run `scripts/validate-agent-config.sh`, `gitleaks detect`, existing script tests (`test-resume-session.sh` etc.).
4. Document and hand off via `.agents/sessions/templates/HANDOFF.md`; update `.agents/memory/architecture.md` open decisions.

## Risks / dependencies

- Concurrent session is actively committing on `mistral-central-auth-authentication` — do not commit this work there; coordinate branch choice.
- Deleting `.cline/skills/` / `.claude/skills/` is destructive (L4): show the diff and get explicit approval first.
- Agents that ignore entry-point instructions lose skill discovery (accepted trade-off of the no-mirrors decision).
- Remote unreachable via SSH (publickey denied) — pushing the new branch needs SSH keys or an HTTPS remote.
- Linear MCP is read-only: the Linear issue for this work must be created manually in the app.

## Validation

- Commands: `bash scripts/resume-session.sh`; `scripts/validate-agent-config.sh` (to be created); `gitleaks detect --source .`; existing `test-*.sh`.
- Results: pending implementation.
- Tests not run and why: none exist yet for the proposed tooling.
