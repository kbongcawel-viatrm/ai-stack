# Linear setup for planning and session handoff

Linear is the planning and workflow source of truth; GitHub remains the source control and code-review source of truth.

## Recommended: Linear remote MCP
1. Sign into your Linear workspace.
2. In a compatible agent, add a remote MCP server at `https://mcp.linear.app/mcp` using the client's supported Streamable HTTP / OAuth configuration.
3. Authenticate through the client and grant only required access.
4. Test that the agent can find an issue and read its description before enabling writes.
5. For write actions, use explicit issue scope and review the changes.

The exact connection UI varies across Cline versions; consult current docs rather than pasting an undocumented config into the CLI.

## Optional Linear CLI
An independent community CLI package named `@humanintheloop/linear` is available. It is not the official Linear app itself; review provenance, permissions, package version, and installation instructions before adopting it. If approved:

```bash
npm install --global @humanintheloop/linear
linear --version
linear auth login
linear init
```

This CLI requires a Linear API token, writes local auth state, and may add an agent workflow section to the current project. Review changes from `linear init` before committing them. It is not required for official Linear MCP integration.

## Session conventions
- One issue per coherent unit of work.
- Include acceptance criteria, risks, and links to relevant files.
- Record progress at meaningful milestones.
- Use `.agents/sessions/templates/HANDOFF.md` before switching workstation, provider, or agent.
- Never store secrets or raw conversations in Linear.

## Sources
- https://linear.app/docs/mcp
- https://linear.app/docs
- Optional community CLI: https://www.npmjs.com/package/@humanintheloop/linear
