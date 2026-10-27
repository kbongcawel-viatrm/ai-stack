# Repository layout

```text
ai-stack/
├── .agents/
│   ├── providers/          # provider/API setup and selection matrix
│   ├── rules/              # cross-agent working agreement
│   ├── memory/             # curated architecture and decisions
│   ├── sessions/templates/ # plan and portable handoff
│   └── skills/             # repeatable SKILL.md playbooks
├── .cline/
│   ├── agents/             # Cline-specific agent definitions
│   ├── hooks/              # reviewed lifecycle hooks
│   ├── plugins/            # project-required plugin documentation
│   └── skills/             # Cline-facing adapters
├── .clinerules/             # Cline project rules
├── docs/                    # setup and workflow documentation
├── scripts/                 # installers and validation
├── .env.example             # placeholders only
└── .gitignore               # local state/secrets excluded
```

`.agents/` is the portable, tool-neutral home for shared context. `.clinerules/` and `.cline/` are Cline-specific entry points. Link to canonical instructions rather than duplicating them.

Do not commit API keys, `.env`, certificates, local Cline sessions/provider settings/logs/databases/worktrees, raw chats, private memory, customer data, or sensitive logs. Git tracks directories only when files are present; README files represent extension points.
