# Architecture decisions

- Updated: 2026-10-27
- Status: proposed baseline

## Goals
- Provider/model modularity so the coding assistant can switch between hosted APIs and local inference.
- Share durable agent rules, skills, memory, and handoff notes across workstations through Git.
- Use Linear for planning, execution status, decisions, and session handoffs.
- Use GitHub as the canonical source-control and review system.

## Boundaries
- Git stores code and curated, non-secret project knowledge; it is not a store for credentials or raw model transcripts.
- Cline CLI is an agent client. Cline API is a separately authenticated HTTP API at `https://api.cline.bot/api/v1`; installing the CLI does not create an API key.
- Each provider/model must be configured and tested independently. Keep endpoint, model ID, and auth requirements explicit.
- Session execution state may remain local to the agent; use a portable Linear handoff plus committed memory rather than assuming task databases sync across machines.

## Open decisions
- Choose a default provider and model after comparing capability, cost, latency, residency, and security.
- Decide which memory files are safe and valuable to commit.
- Confirm the desired Linear workflow/team and issue identifier convention.
