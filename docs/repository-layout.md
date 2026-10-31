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
├── .github/workflows/       # CI and manually dispatched automation
├── docs/                    # setup and workflow documentation
├── reusable-workflows/     # reusable automation packages and workflow components
│   └── php-patch-automation/ # isolated Python workspace for multi-cloud PHP inventory and guarded patch orchestration
├── terraform/               # reusable cloud modules and BU/environment/region roots
├── scripts/                 # installers, session doc generator, and validation
├── .env.example             # placeholders only
└── .gitignore               # local state/secrets excluded
```

`.agents/` is the portable, tool-neutral home for shared context. `.clinerules/` and `.cline/` are Cline-specific entry points. Link to canonical instructions rather than duplicating them.

Terraform deployment conventions and the BU-scoped GitHub Actions workflow are documented in [`terraform/README.md`](../terraform/README.md). The BU registry is intentionally empty until cloud identities and remote-state backends are provisioned.

Do not commit API keys, `.env`, certificates, local Cline sessions/provider settings/logs/databases/worktrees, raw chats, private memory, customer data, Terraform state, plan files, real `.tfvars`, or sensitive logs. Git tracks directories only when files are present; README files represent extension points.
