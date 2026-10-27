# Cline project skills

Cline loads project skills from this directory when the repository is opened as a workspace. Each skill lives in its own folder and uses a `SKILL.md` file with YAML frontmatter (`name` and `description`).

The canonical cross-agent skill source is `.agents/skills/`; matching copies are maintained in `.cline/skills/` so Cline can discover the skills directly. When adding or changing a skill, update both locations and verify that every canonical skill has a matching Cline copy.

## Skills

- `api-provider-setup`
- `bash-scripting`
- `container-tuning`
- `data-stream-planning`
- `fluent-bit-generator`
- `fluent-bit-validator`
- `linear-session-workflow`
- `ollama-llm-training`
- `openobserve-operations`
- `podman-container-management`
- `python-development`
- `security-forensics-analysis`

## Verification

From the repository root, compare the canonical and Cline skill folder names and ensure each contains `SKILL.md`. Reload the Cline workspace after adding skills if they do not appear in skill discovery.
