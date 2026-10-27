# Linear and GitHub MCP setup for Cline

This repository includes a project-level MCP configuration at `.cline/mcp.json`. It defines the official hosted Linear MCP server and GitHub's hosted MCP endpoint. MCP tools are powerful; keep write tools unapproved by default and review every write action.

## Linear

- Endpoint: `https://mcp.linear.app/mcp`
- Transport: Streamable HTTP
- Authentication: complete the OAuth sign-in flow when Cline prompts.
- The endpoint is the official hosted Linear MCP server; a separate custom Linear OAuth application is not required for the standard connection.
- For read-only access, use `https://mcp.linear.app/mcp/readonly` instead.

After opening the repository in Cline, open **MCP Servers**, inspect the project server configuration, connect to Linear, and complete browser authorization. Test with a read-only request (for example, list teams or find an issue) before allowing write operations.

## GitHub

- Endpoint: `https://api.githubcopilot.com/mcp/`
- Transport: Streamable HTTP
- Authentication: GitHub Personal Access Token (PAT).

The committed `.cline/mcp.json` contains a placeholder only. Do not commit a real PAT. Before connecting, replace `REPLACE_WITH_GITHUB_PERSONAL_ACCESS_TOKEN` in your local working copy with a token created for your account. Prefer a fine-grained PAT restricted to the repositories and permissions required for your tasks. Start with read-only access; grant contents/issues/pull-request write permissions only if your workflow requires them.

Because a token is a secret, do not paste a real token into chat, issue comments, logs, or committed files. If the local config is accidentally committed with a real token, revoke the token immediately and remove it from history as appropriate.

## Load and verify

1. Open the repository root in Cline.
2. Open **MCP Servers** and review the project MCP configuration.
3. Authenticate Linear through OAuth and set the local GitHub token placeholder.
4. Restart/reload the MCP servers.
5. Confirm both servers report connected and their tools are listed.
6. Test read-only operations first. Keep `autoApprove` empty so Cline asks before using tools.
7. Check the loaded configuration with `cline config mcp --json` if supported by your installed Cline CLI.

Cline also supports user-level MCP configuration. If your installed version does not load project-level `.cline/mcp.json`, add the same server entries through **MCP Servers → Configure MCP Servers** in Cline's settings. Do not overwrite existing user-level server entries; merge them.

## Security notes

- The project config is a template. OAuth approval and the GitHub PAT are local user actions and cannot be completed by committing this file.
- Never enable blanket auto-approval for issue creation, repository writes, PR merges, or destructive actions.
- Review repository scope, permissions, and organization policy before authorizing GitHub.
- Official docs:
  - https://linear.app/docs/mcp
  - https://github.com/github/github-mcp-server
  - https://github.com/cline/cline/blob/main/docs/mcp/mcp-overview.mdx
