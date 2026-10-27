# Linear planning and documentation workflow

## Issue structure
Each task should include context/problem, goal and exclusions, acceptance criteria, dependencies/risks, validation plan, and relevant repository paths/links.

## Session workflow
1. Search existing issues before creating a duplicate.
2. Plan non-trivial changes and link the branch/PR.
3. Update issue progress at meaningful milestones.
4. Before switching workstation/provider/agent, add a handoff based on `.agents/sessions/templates/HANDOFF.md`.
5. Put reusable decisions in `.agents/memory/`, link them from Linear, and avoid copying secrets or raw transcripts.
6. Close only when acceptance criteria and validation are satisfied or limitations are explicit.

## Agent integration
Use Linear's official remote MCP endpoint `https://mcp.linear.app/mcp`. Configure it through the compatible client's supported MCP workflow and authenticate through the official process. Keep permissions scoped and review write actions.
