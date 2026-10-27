---
name: session-resume
description: Resume an interrupted AI engineering session by inspecting local Git state, the latest handoff/session Markdown, related Linear references, and unchecked actions without changing the worktree.
---

# Resume a session safely

1. Run `bash scripts/resume-session.sh` from the repository.
2. Treat its output as a local snapshot, not live Linear state. Use the configured read-only Linear MCP to fetch the referenced issue when current issue status or comments are needed.
3. Review branch and worktree status before proposing edits. Never reset, clean, checkout, pull, stage, or modify files as part of session discovery.
4. Read the full latest handoff and relevant session record; identify unchecked actions, blockers, validation still needed, and the next safe step.
5. If the session is associated with a known Linear issue, pass it explicitly: `bash scripts/resume-session.sh --linear ENG-123`.
6. If no handoff exists, report that fact. Do not treat the template as an actual handoff or invent prior progress.
7. Do not copy secrets or sensitive output into Linear or session notes.

The script is read-only and does not call Linear directly. Linear MCP should remain configured with its read-only endpoint.
