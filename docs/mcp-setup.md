# Read-only Linear and GitHub MCP setup for Cline

The project MCP configuration at `.cline/mcp.json` uses **read-only server endpoints** for both Linear and GitHub. This is a server-side tool restriction; `autoApprove: []` is an additional approval safeguard, not the mechanism that makes the connections read-only.

## Linear

- Endpoint: `https://mcp.linear.app/mcp/readonly`
- Transport: Streamable HTTP
- Authentication: use OAuth if the client requests it, or a Linear API key with only the **Read** permission.
- The `/readonly` endpoint only exposes read tools. Do not change it to `/mcp` unless write access is explicitly approved.

Test with a read-only request, such as finding an issue or listing teams. Do not use create, update, comment, or state-transition operations.

## GitHub

- Endpoint: `https://api.githubcopilot.com/mcp/readonly`
- Transport: Streamable HTTP
- Authentication: GitHub token supplied locally.

The `/readonly` endpoint disables write tools on the MCP server. The committed `.cline/mcp.json` contains a placeholder only. Replace `REPLACE_WITH_READ_ONLY_GITHUB_TOKEN` locally with a token that has only the minimum required **read** permissions and is restricted to the intended repositories. Do not use a classic PAT or fine-grained PAT with contents, issues, pull requests, actions, or other write permissions.

The endpoint restriction and the token permissions should both be read-only. The token permissions remain important because credentials can be used outside this MCP client too.

## Verify after configuration

1. Open the repository in Cline and reload the MCP servers.
2. Confirm the displayed Linear and GitHub endpoints end in `/readonly`.
3. Confirm the GitHub token has read-only repository permissions and the Linear credential has only read scope/permission.
4. Verify that search/read tools are available.
5. Verify that create/update/delete/merge tools are not exposed. If any write tool is available, disconnect the server and investigate before use.
6. Keep `autoApprove` empty. This requires approval for tool calls where supported but is not a substitute for server-side read-only mode.

## Important limitations

- A project config cannot force a user to choose read-only credentials when they authenticate. Check the actual token/scopes in the provider settings.
- These settings apply to these MCP connections only; they do not make GitHub access through other credentials, the browser, CLI, or other MCP servers read-only.
- Do not store credentials in this tracked file, `.env.example`, Linear issues, logs, or commits. If a real token is committed, revoke it immediately.
- Do not switch either endpoint back to a read-write URL without explicit authorization.

## Official documentation

- Linear MCP: https://linear.app/docs/mcp
- GitHub MCP server configuration: https://github.com/github/github-mcp-server/blob/main/docs/server-configuration.md
- GitHub remote MCP server: https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md
- Cline MCP overview: https://github.com/cline/cline/blob/main/docs/mcp/mcp-overview.mdx
