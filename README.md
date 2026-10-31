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
Prerequisite: Bash, Git, and network access. The installer bootstraps nvm (pinned to v0.40.8 by default) and installs the latest Node.js LTS with `nvm install --lts`; npm comes bundled with Node.js.

```bash
./scripts/install-ai-tools.sh
cline --version
cline auth
```

The installer uses nvm to install and activate the latest Node.js LTS and sets the default alias to `lts/*`. It then installs the selected global npm tools under that nvm-managed Node.js version. It does not authenticate or create credentials. Re-run the installer to refresh the active LTS; global npm packages are version-specific under nvm.

### Configure a provider
Read [Cline CLI setup](.agents/providers/cline-cli.md) and [Cline API setup](.agents/providers/cline-api.md). The Cline API is at `https://api.cline.bot/api/v1`; it is not a separate CLI package. Create API keys in the official account and keep them outside Git. Other providers require their own supported model IDs and auth.

`.env.example` documents variable names only. A local `.env` is ignored; never commit credentials.

### Linear
Use Linear's official MCP endpoint `https://mcp.linear.app/mcp` with the compatible client's authenticated MCP setup. See [workflow](docs/linear-planning.md) and [provider notes](.agents/providers/linear.md). An optional third-party CLI is documented there; it is not required for Linear MCP:

```bash
INSTALL_LINEAR_CLI=1 ./scripts/install-ai-tools.sh
```

Review package provenance and workflow side effects before adoption.

### Resume an interrupted session

Run the read-only session report from the repository root:

```bash
bash scripts/resume-session.sh
# Optionally identify a known Linear issue explicitly:
bash scripts/resume-session.sh --linear ENG-123
```

It reports the current branch and worktree status, the newest actual handoff and session record, Linear references found in those local files, and unchecked checklist actions. It does not modify Git state or call Linear directly. Use the configured read-only Linear MCP to fetch live issue details. See the [session-resume skill](.agents/skills/session-resume/SKILL.md).

### Session documentation and memory

Linear is the authoritative memory for session progress, decisions, blockers, and handoffs. Keep repository Markdown as a concise, portable snapshot linked to the Linear issue and Git commit rather than maintaining a second full narrative. Generate a session record interactively with:

```bash
./scripts/new-session-doc.sh 001 initialize
```

This creates `docs/sessions/session#001-initialize.md` with the numbered sections Date, Summary, Plan, Changes, Validation steps, Commands, and `session#001 | <git hash commit>`. Enter multiline sections one line at a time and finish each with a single `.`. Supply the real Linear issue ID/URL. Verify or update the commit hash after the final commit; the script defaults to the current `HEAD` SHA and accepts `GIT_COMMIT=<sha>` to override it. It refuses to overwrite an existing session file. Run its test with `bash scripts/test-new-session-doc.sh`.

### Plan and hand off
Create/update a Linear issue with a goal and acceptance criteria. Use `.agents/sessions/templates/SESSION_PLAN.md` for planning and `HANDOFF.md` for cross-device handoff. Commit only durable, non-sensitive memory. See [repository layout](docs/repository-layout.md).

## Linear session workflow and documentation

Use a numbered session ID to make work traceable across Linear, repository documentation, and Git commits. A session is a coherent unit of work, not a single chat transcript. Use the same ID in the Linear issue title, session document, commit message, and handoff.

### Session naming convention

- Linear issue title: `session#001 - Initialize scripts and folder structure`
- Repository session note: `docs/sessions/session-001.md` (create one per completed session when a durable write-up is useful).
- Branch: `session-001-initialize-scaffold` (or include the real Linear issue identifier, e.g. `ENG-123-session-001-initialize-scaffold`).
- Commit subject: `session#001: initialize scripts and folder structure`
- Commit reference in documentation: `session#001: <full-git-commit-sha>`

Keep the sequential session number as the stable project identifier. Also include the actual Linear issue identifier/URL (for example, `ENG-123`) once Linear creates it; do not invent a Linear issue ID. The session number and Linear issue identifier are separate fields.

### What each Linear session issue must contain

1. **Summary** — a concise statement of the delivered outcome.
2. **Goal and scope** — why the work is needed, what is included, and explicit exclusions.
3. **Tasks and implementation** — checklist of scripts, folders, configuration, skills, MCP servers, and documentation changed.
4. **Acceptance criteria** — observable conditions that must be met before marking the session complete.
5. **Validation** — exact commands, test results, CI links, and any checks not run.
6. **Decisions and risks** — relevant choices, trade-offs, blockers, and rollback notes.
7. **Source control** — branch, commit SHA, changed paths, and pull request link if applicable.
8. **Next session** — concrete follow-up work and any dependencies.
9. **Security check** — confirm that no API keys, access tokens, private user data, or raw chat transcripts were copied into Linear or Git.

### Step-by-step workflow

1. **Find or create the Linear issue.** Search for the session number/title first to avoid duplicates. Create an issue in the appropriate team/project, use the next unused session number, and include the goal and acceptance criteria.
2. **Prepare the plan.** Copy the structure from `.agents/sessions/templates/SESSION_PLAN.md`. Add the Linear issue identifier, branch, context, risks, plan, and validation steps. Put detailed durable documentation in `docs/` and link it from the issue.
3. **Implement the work.** Make a focused change. Keep code, configuration, and skill files in their proper directories. Record meaningful milestones in Linear rather than pasting raw conversations.
4. **Validate the result.** Run applicable tests and configuration checks. Record commands and outcomes honestly; distinguish passed, failed, skipped, and not-run checks.
5. **Commit the change.** Use a descriptive commit message containing the session number. Capture the full commit SHA from Git after the commit succeeds. Do not write a guessed or shortened hash as if it were the full SHA.
6. **Update Linear.** Add the summary, changed paths, validation results, commit SHA/link, blockers, and next actions. Move the issue to the team's completed state only when its acceptance criteria are satisfied.
7. **Write the session record.** Update the session log below or add `docs/sessions/session-NNN.md` for a larger session. Link the real Linear issue and Git commit. A documentation commit's SHA cannot be embedded in itself without creating another commit; update the session log in a follow-up commit if it needs to reference the commit that finalized the session record.
8. **Hand off.** Before switching machine, model, provider, or agent, complete `.agents/sessions/templates/HANDOFF.md` with current state, decisions, validation, and next actions.

### Session record format

Use this format in a Linear issue description or in `docs/sessions/session-NNN.md`:

```markdown
# session#NNN - <short outcome>

- Linear issue: <real issue identifier and URL, or "not created yet">
- Status: planned | in progress | blocked | complete
- Branch: <branch name>
- Commit: <full SHA and GitHub commit URL, or "pending">

## Summary
<What was delivered and why it matters.>

## Tasks completed
- [ ] <specific implementation or documentation task>

## Acceptance criteria
- [ ] <observable success condition>

## Validation
- Command: <exact command>
- Result: <passed/failed/not run and evidence>

## Decisions / risks
- <decision, rationale, blocker, or none>

## Next session
- <next concrete step>
```

### Session log

#### session#001 - Initialize scripts and folder structure

**Status:** Baseline scaffold recorded; associate this session with its actual Linear issue when Linear is connected.

**Summary:** Established the initial repository structure and the reusable agent workflow. The baseline includes the setup installer and its tests; shared `.agents/` rules, memory, provider notes, skills, and session templates; Cline-specific `.cline/` and `.clinerules/` entry points; Linear planning guidance; environment-variable examples; repository layout documentation; and GitHub Actions validation. Follow-up work expanded the skills collection and added Cline skill mirrors plus Linear/GitHub MCP setup documentation and configuration.

**Tasks represented by this baseline**
- Installer and safe installer tests for setting up Cline tooling.
- Agent context directories for rules, memory, provider setup, skills, and session handoffs.
- Linear session planning conventions and templates.
- Cline-specific project structure and shared skill discovery.
- MCP configuration template for Linear and GitHub, with credentials kept local.
- Documentation and CI checks for scaffold integrity and skill parity.

**Baseline commit reference:** `session#001: 4122988c723ef0fa9ce7108c5b9c0f1b2887d51a` ([commit](https://github.com/kbongcawel-viatrm/ai-stack/commit/4122988c723ef0fa9ce7108c5b9c0f1b2887d51a)).

> The SHA above identifies the current scaffold/MCP/skill-validation baseline checkpoint, not a claim that every listed task was introduced by one atomic commit. The work was built across multiple commits. Link the actual Linear issue once created.

#### session#002 - Set up Cline app, CLI, provider, and model

**Status:** Planned — do not mark complete until provider authentication and model selection have been tested.

**Summary:** Configure the Cline IDE application and Cline CLI to use a deliberate provider/model combination. Confirm the provider's supported API endpoint, model identifier, authentication method, and any required capabilities. Keep IDE and CLI configuration consistent where appropriate while respecting their separate configuration stores.

**Planned tasks**
- Install or update Cline CLI and verify its version.
- Set up the Cline IDE extension/app and confirm the repository opens as a workspace.
- Select the intended provider (Cline API or another supported provider) and verify the exact model ID against current provider documentation.
- Configure API endpoint and credentials using the supported UI/CLI flow; do not put secrets in tracked files or Linear.
- Verify model availability, authentication, basic completion, and tool-use behavior where applicable.
- Document local prerequisites, configuration locations, test commands, and troubleshooting steps.
- Update the Linear issue with validation evidence and commit the completed changes.

**Acceptance criteria**
- Cline CLI starts and reports the expected version.
- Cline IDE app loads the project rules and project skills.
- The chosen provider authenticates successfully and the selected model responds to a test prompt.
- No secrets are committed or written to the session record.
- Validation and any limitations are documented.

**Commit reference:** `session#002: pending implementation` — replace with the full Git SHA after the implementation commit exists.

### Commit and session traceability

- Use one focused implementation commit per coherent session when practical; split unrelated work into separate commits.
- A session may span several commits. If so, record the primary completion commit plus any related commit links in Linear.
- Record a full commit SHA and clickable GitHub URL only after GitHub confirms the commit exists.
- Never fabricate a Linear issue ID, commit SHA, test result, or completion status.
- Keep Linear as the work planning/handoff record and GitHub as the source-control record. The session log in this README is a concise index, not a replacement for the detailed issue.

## Structure
```text
.agents/       portable rules, memory, provider docs, skills, agent definitions, session templates
.clinerules/   Cline project rules
.cline/        Cline-specific extension points and project MCP configuration
docs/          architecture and workflow documentation
scripts/       repeatable setup and static validation
.github/       CI validation and pull-request template
```

## GitHub agent and Git operations

The repository includes a dedicated [GitHub agent](.agents/agents/github-agent.md) and a reusable [Git operations skill](.agents/skills/git-operations/SKILL.md), mirrored for Cline at `.cline/skills/git-operations/SKILL.md`. Follow the skill before repository synchronization, commits, pushes, pull requests, and editor swap-file cleanup.

Important safeguards:
- The required `git reset --hard HEAD` is destructive; inspect `git status` first and never discard unapproved user work.
- Commit and push code changes before host-related changes or host-mutating tests, then record the actual commit SHA and validation evidence.
- Configure the requested global Git identity on the workstation only; do not alter a remote runner's global configuration as a side effect.
- Remove only reviewed `*.swp` and `*.swo` files. These patterns are already covered by `.gitignore`.

The GitHub API changes made to this repository are committed remotely. Workstation-level Git config changes and local swap-file cleanup must be run and verified on the workstation itself.

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


## Skill discovery and upstream source repositories

Agents must search `.agents/skills/` for skills that are close or similar to a task and read the relevant `SKILL.md` before implementation. Technology-specific tasks should consult the curated [upstream GitHub repository registry](.agents/sources/github-repositories.md), use official version-matched docs/source as evidence, and keep canonical skills under `.agents/skills/` synchronized with Cline copies under `.cline/skills/`. Upstream repositories are references by default; do not vendor or add submodules unless explicitly required and approved. The registry calls out the ambiguity of the name “Python worker” rather than silently assuming a framework.


## PHP patch automation workspace

The `reusable-workflows/php-patch-automation/` module provides an Ansible-free Python workspace for multi-cloud PHP inventory, policy validation, and guarded patch orchestration. It includes a Codespaces-ready development environment, fixture data, AWS Systems Manager and Azure Resource Graph read-only adapters, and module-scoped GitHub Actions workflows.

Open the repository in Codespaces to use the root devcontainer. The post-create step bootstraps the module's Python environment. Then run:

```bash
cd reusable-workflows/php-patch-automation
make validate
make discover-fixtures
```

Cline CLI remains installed separately through `./scripts/install-ai-tools.sh`; authenticate with `cline auth`. The shared agent instructions are in [the PHP patch automation skill](.agents/skills/php-patch-automation/SKILL.md), mirrored for Cline under `.cline/skills/`.

**Safety boundary:** the starter supports fixture discovery and read-only cloud metadata discovery only. It does not discover guest PHP packages or execute cloud patch operations. The guarded workflows intentionally block those paths until identity, guest inventory, provider execution, approvals, health checks, and rollback are implemented and reviewed. See [module documentation](reusable-workflows/php-patch-automation/README.md).
