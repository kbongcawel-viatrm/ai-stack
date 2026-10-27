# Agent workspace

This repository keeps shareable agent operating context in Git. The intended structure is portable across Cline CLI, IDE agents, and other coding tools; some tools may need adapters.

- `rules/`: durable working agreements and safety constraints.
- `memory/`: concise, reviewed decisions and technical context.
- `skills/`: reusable task playbooks containing `SKILL.md`.
- `sessions/templates/`: planning and handoff templates; never commit raw transcripts or sensitive logs.
- `providers/`: provider catalog and setup notes; never provider secrets.

Cline-compatible project config also lives in `.clinerules/` and `.cline/`. Keep workstation credentials and state in local config directories.

Memory is curated project documentation, not a transcript dump. Record durable facts, decisions, references, consequences, and unresolved questions. Do not record credentials, personal secrets, customer data, or unredacted incident details.
