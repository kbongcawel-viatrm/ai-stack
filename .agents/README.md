# Agent workspace

This repository keeps shareable agent operating context in Git. The intended contract is portable across Cline CLI, IDE agents, and other coding tools; each tool may require a small adapter/configuration.

## Directories

- `rules/`: durable working agreements and safety constraints.
- `memory/`: concise, reviewed project decisions and technical context.
- `skills/`: reusable task playbooks (each skill contains a `SKILL.md`).
- `sessions/templates/`: portable planning and handoff templates. Do not commit raw transcripts, tokens, or sensitive logs.
- `providers/`: provider catalog and setup notes; never provider secrets.

Cline-compatible project config also lives in `.clinerules/` and `.cline/`. Keep shared instructions in source control and workstation credentials/state in local config directories.

## Memory hygiene

Memory is curated project documentation, not a transcript dump. Record dated facts, decisions, references, consequences, and unresolved questions. Do not record credentials, personal secrets, customer data, or unredacted incident details.
