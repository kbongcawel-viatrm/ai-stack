# Cline project configuration

Cline-facing project context lives in `.cline/` (rules, skills, hooks, agents, plugins, and shared endpoint templates) and root-level `.clinerules/`. Tool-neutral guidance lives in `.agents/`.

Use `cline auth` after installation to configure a model provider. The MCP definitions in [mcp.json](mcp.json) are a tracked connection template; merge them into the active Cline MCP settings and complete OAuth or local token setup. See [MCP setup](../docs/mcp-setup.md). Do not commit Cline's local session state, OAuth state, or provider credentials.
