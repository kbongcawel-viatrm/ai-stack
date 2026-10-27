# Architecture decisions

- Updated: 2026-10-27
- Status: proposed baseline

## Goals
- Provider/model modularity across hosted APIs and local inference.
- Share durable agent rules, skills, memory, and handoff notes across workstations through Git.
- Use Linear for planning, status, decisions, and session handoffs.
- Use GitHub as canonical source control and review.

## Boundaries
- Git stores code and curated, non-secret project knowledge, not credentials or raw model transcripts.
- Cline CLI is an agent client. Cline API is a separately authenticated HTTP API at `https://api.cline.bot/api/v1`; installing the CLI does not create an API key.
- Configure and test each provider/model independently; keep endpoint, model ID, authentication, and region explicit.
- Use a portable Linear handoff plus curated memory rather than assuming task databases sync between machines.

## Open decisions
- Choose a default provider/model after comparing capability, cost, latency, residency, and security.
- Decide which memory files are safe and valuable to commit.
- Confirm Linear team/workflow and issue identifier convention.
