# Project-wide Cline rules

Follow `.agents/rules/working-agreement.md` as the primary working agreement.

## Required context
- Read the relevant skill in `.agents/skills/` before executing a specialized workflow.
- Treat `.agents/memory/` as curated project context; verify old or time-sensitive facts before relying on them.
- For non-trivial work, prepare a plan with acceptance criteria and keep the relevant Linear issue current when integration is available.

## Safety
- Never commit credentials or sensitive data.
- Ask for approval before destructive operations, external deployment, permissions changes, or billable resource creation.
- Run relevant checks and report exact results. Do not assert that checks passed when they were not run.
