---
name: linear-session-workflow
description: Use Linear issues to plan work, track execution, preserve decisions, and hand off an agent session across workstations.
---

# Linear planning and session workflow

1. Search for an existing Linear issue before creating a duplicate.
2. For non-trivial work, create or update an issue with problem statement, scope, acceptance criteria, dependencies, and risks.
3. Use the Linear issue identifier in branch names, for example `ENG-123-provider-setup`, and link pull requests to that issue.
4. Store the active plan in the issue description or a linked document. Add brief progress updates at milestones.
5. At a workstation/model switch, post a concise handoff using `.agents/sessions/templates/HANDOFF.md`: current state, changed paths, validation, decisions, blockers, and next actions.
6. Commit durable decisions to `.agents/memory/` and source them from Linear; do not assume transient chat/task history is portable.
7. Before closing the issue, confirm acceptance criteria and validation, link PR/commit, and state remaining limitations.
8. Do not include API keys, tokens, raw transcripts, customer-sensitive data, or production secrets in Linear.

## Integration
Use Linear's official remote MCP endpoint `https://mcp.linear.app/mcp` from a compatible client and authenticate via the supported OAuth flow. For optional Linear CLI installation, follow `.agents/providers/linear.md` and verify package provenance first.
