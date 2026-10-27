# Agent workspace

This repository keeps shareable agent operating context in Git. The intended structure is portable across Cline CLI, IDE agents, and other coding tools; some tools may need adapters.

- `rules/`: durable working agreements and safety constraints.
- `memory/`: concise, reviewed decisions and technical context.
- `skills/`: reusable task playbooks containing `SKILL.md`.
- `sessions/templates/`: planning and handoff templates; never commit raw transcripts or sensitive logs.
- `providers/`: provider catalog and setup notes; never provider secrets.

Cline-compatible project config also lives in `.clinerules/` and `.cline/`. Keep workstation credentials and state in local config directories.

Memory is curated project documentation, not a transcript dump. Record durable facts, decisions, references, consequences, and unresolved questions. Do not record credentials, personal secrets, customer data, or unredacted incident details.


## Skill discovery and upstream sources

Before acting on a task, search `.agents/skills/` for skills whose descriptions or workflows are close or similar to the task, even when terminology differs. Read all relevant `SKILL.md` files and follow their safety and validation guidance. For technology-specific research, use the curated [upstream GitHub repository source registry](sources/github-repositories.md). Keep canonical skills in `.agents/skills/` and their Cline copies in `.cline/skills/` synchronized.
