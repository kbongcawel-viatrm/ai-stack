---
name: vite-app-development
description: |
  Develop, deploy, and operate the vite-apps stack — a Vite + TypeScript
  management dashboard fronting a hardened code-server (VS Code in the
  browser) instance, exposed publicly via rootless Podman Caddy +
  Cloudflare Tunnel with Cloudflare Access SSO.

  Use when: working on the vite-apps / vite-ide repo, the mgmt-dashboard,
  code-server edge proxy, Caddy/cloudflared tunnel configs, Cloudflare
  Access/DNS for home-security.uk, or replicating this pattern for other
  browser IDE deployments.
license: MIT
---

# Vite app development — dashboard + code-server + Cloudflare

Reference implementation lives at `/var/home/kim/workspace/vite-apps`
(git repo `kbongcawel-viatrm/vite-ide`, private). This skill captures the
architecture and the hard-won operational details.

## Architecture

```text
browser ──TLS──> Cloudflare edge (*.home-security.uk)
              └─> Access SSO check (team domain home-security-xyz)
              └─> cloudflared (rootless podman, host net) ──TLS──> Caddy 127.0.0.1:8443
                                                                     ├── ide.home-security.uk      -> 127.0.0.1:8080 edge proxy -> 127.0.0.1:18080 code-server
                                                                     └── manager.home-security.uk  -> 127.0.0.1:5173 standalone UI
```

| Layer | Port | Bind | Notes |
|---|---|---|---|
| Manager UI (`standalone.mjs`) | 5173 | **127.0.0.1** | serves `workspace/mgmt-dashboard/dist` + `/api/code-server/*` |
| Edge proxy (`code-server-manager.mjs`) | 8080 | 127.0.0.1 | security headers, login rate limit, strips `$PASSWORD` hint, WS proxy |
| code-server | 18080 | 127.0.0.1 | `--auth password`, internal only |
| Caddy | 8443 | 127.0.0.1 | `tls internal` per-host vhosts, `auto_https disable_redirects` (rootless can't bind :80) |
| cloudflared | — | host net | remotely-managed tunnel `vite-apps` (`832eb852-9827-45f2-97b2-0a5cd0c79a4e`), token in `.env` |

Repo layout: `workspace/mgmt-dashboard/` (Vite+TS UI), `workspace/ide/`
(`server/`, `scripts/`, `deploy/`, `compose.yaml`). Root `package.json`
delegates scripts. systemd user unit: `deploy/vite-apps.service` via
`scripts/deploy/start.sh` (nvm node path).

## Auth model (final)

- **Cloudflare Access** is the only public gate: self-hosted app `vite-apps`
  covering both hostnames, GitHub IdP, allow policy = 4 known emails,
  24h sessions. Unauthenticated → 302 to
  `home-security-xyz.cloudflareaccess.com/cdn-cgi/access/login/<host>`.
- **code-server `PASSWORD`** (.env) still required at the editor login.
- The manager has **no app-level login** — deliberately removed; the
  standalone server binds localhost only so its open API is never LAN-exposed.
- Do NOT reintroduce custom OAuth/portal code — the `my.home-security.uk`
  plan was abandoned (hostname is an R2 custom domain for bucket
  `connector`; DNS record is Cloudflare-managed, deletion needs R2 access).

## Cloudflare facts

- Account `home-sec-uk` `7e1714b3d1b32fcaad4a5029c638cde4`, zone
  `home-security.uk` `f5c4bcafdbbd8b96b8d9b584d0523535`.
- Second account `code.home-security.uk` `9a831e59...` has a **pending
  duplicate zone** (ns_mismatch) — never target it; it can never activate.
- Tunnel ingress is **remotely managed** (set via API/dashboard, not
  `config.yml`): each hostname → `https://127.0.0.1:8443` with
  `originServerName` = real hostname and `httpHostHeader` = real hostname.
- `config.yml`/`Caddyfile.tunnel` in repo are reference/fallback only.
- MCP: `cloudflare` server (`https://mcp.cloudflare.com/mcp`, OAuth via
  `devin mcp login cloudflare`). R2 endpoints 403 on home-sec-uk — R2 not
  enabled or scope missing; use dashboard for bucket ops.

## Gotchas that cost real debugging time

1. **cloudflared `localhost` → `::1`** but Caddy binds IPv4 `127.0.0.1` →
   always use `https://127.0.0.1:8443`, never `localhost`.
2. **SNI mismatch**: cloudflared sends SNI = origin host unless
   `originServerName` is set; Caddy internal certs are per-hostname → TLS
   `internal error`. Set both `originServerName` and `httpHostHeader`.
3. **Login-page rewrite**: strip `accept-encoding` before proxying code-server
   `/login` HTML or gzip/br defeats the `$PASSWORD`-hint removal.
4. **Local DNS**: stub resolver may serve stale negatives for new CF records;
   test with `dig @1.1.1.1` and `curl --resolve` before assuming tunnel failure.
5. Rootless podman **cannot bind :80** — hence `auto_https disable_redirects`.
6. code-server WebSocket upgrade requires a `code-server-session` cookie.
7. Node lives at `~/.local/share/pi-node/current/bin` — prepend to PATH for
   npm/node commands.

## Routine commands

```bash
npm run build                 # dashboard -> dist/
systemctl --user restart vite-apps.service
npm run deploy                # build + app + podman-compose up -d
podman-compose -f workspace/ide/compose.yaml ps|logs|down
curl -s https://ide.home-security.uk/login        # expect 200 (post-Access)
curl -sI https://manager.home-security.uk/        # expect 302 -> cloudflareaccess.com
```

## Rules that apply

- **Never `git push` without explicit operator approval** — the operator is
  the push gate (also in ai-stack/AGENTS.md, all agents).
- **Operator approval before any consequential MCP mutation** (DNS, tunnel,
  Access, firewall).
- Secrets stay in `.env` / `credentials.json` — gitignored, never commit.
- Rootless podman only; never `sudo podman`.
- Blue Light theme (`msnilshartmann.blue-light`) is the UI palette for both
  dashboard and code-server.
