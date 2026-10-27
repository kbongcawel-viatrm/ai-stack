---
name: linear-session-workflow
description: Use Linear issues to plan work, track execution, preserve decisions, and hand off agent sessions across workstations.
---

# Linear planning and session workflow

1. Search for an existing issue before creating a duplicate.
2. For non-trivial work, create/update an issue with problem, scope, acceptance criteria, dependencies, and risks.
3. Use the issue identifier in branch names (e.g. `ENG-123-provider-setup`) and link pull requests to it.
4. Keep plans and milestone updates in the issue description/comments or a linked document.
5. Before switching workstation/provider/agent, post a handoff using `.agents/sessions/templates/HANDOFF.md`: current state, changed paths, validation, decisions, blockers, next actions.
6. Commit durable decisions to `.agents/memory/`; do not assume transient task history is portable.
7. Close only after acceptance criteria and validation are satisfied or limitations are explicit.
8. Never put API keys, tokens, raw transcripts, sensitive customer data, or production secrets in Linear.

Use Linear's official remote MCP endpoint `https://mcp.linear.app/mcp` from a compatible client and authenticate with its supported OAuth flow. See `.agents/providers/linear.md`.
