# Linear setup for planning and session handoff

Linear is the planning and workflow source of truth; GitHub remains the source control and code-review source of truth.

## Read-only MCP (required default)

Use the official read-only Linear MCP endpoint:

`https://mcp.linear.app/mcp/readonly`

1. Configure the client to use the `/readonly` endpoint.
2. If using OAuth, request/grant only the `read` scope when the client supports choosing scopes.
3. If using an API key, create one with only the **Read** permission enabled.
4. Test by finding an issue or reading a description.
5. Confirm create/update/comment/state-transition tools are not exposed.

Do not use `https://mcp.linear.app/mcp` for this project by default; that is the read-write endpoint. Do not change to a read-write endpoint or authorize a write-scoped credential without explicit approval.

The exact connection UI varies across Cline versions; consult current docs rather than pasting an undocumented config into the CLI.

## Optional Linear CLI

The community package `@humanintheloop/linear` can perform operations using its own credential and is outside the protection of the read-only MCP endpoint. Do not install or authenticate it for routine agent access unless it has been separately reviewed and explicitly approved for read-only use. A read-only MCP URL does not restrict other clients or direct API access.

## Session conventions

- One issue per coherent unit of work.
- Include acceptance criteria, risks, and links to relevant files.
- Record progress at meaningful milestones.
- Use `.agents/sessions/templates/HANDOFF.md` before switching workstation, provider, or agent.
- Never store secrets or raw conversations in Linear.

## Sources

- https://linear.app/docs/mcp
- https://linear.app/docs
