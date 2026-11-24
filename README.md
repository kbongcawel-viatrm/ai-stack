# ai-stack
[terraform](https://img.shields.io/badge/terraform-#8A2BE2)
[ansible](https://img.shields.io/badge/ansible-EE0000)
[gnu-bash](https://img.shields.io/badge/gnu-bash-4EAA25)

> [!CAUTION]
> **Warning:**  
> Made for mad science and breaking stuff.

## A repository full of my own AI skills. 
<img src="https://github-readme-insight-terminal-asci.vercel.app/svg/repo?repo=kbongcawel-viatrm/ai-stack&amp;theme=mac" alt="GitHub repo">

## Stack
![Skills](https://github-readme-insight-terminal-asci.vercel.app/svg/skills?i=terraform,ansible,bash,GitHubActions,Cline&theme=mac)

## Repository layout

```bash
ai-stack$ tree -L1 --dirsfirst
.
├── ansible                  # Ansible playbooks for automation
├── docs                     # All documentation storage
├── projects                 # Per project directory
├── scripts                  # Bash scripts
├── terraform                # Terraform scripts
├── AGENTS.md                # Agent instructions
├── package.json            
├── package-lock.json
├── README.md 
└── skills-lock.json
```

## Instructions
`.agents/` is the portable, tool-neutral home for shared context. `.clinerules/` and `.cline/` are Cline-specific entry points. Link to canonical instructions rather than duplicating them.

Terraform deployment conventions and the BU-scoped GitHub Actions workflow are documented in [`terraform/README.md`](../terraform/README.md). The BU registry is intentionally empty until cloud identities and remote-state backends are provisioned.

Do not commit API keys, `.env`, certificates, local Cline sessions/provider settings/logs/databases/worktrees, raw chats, private memory, customer data, Terraform state, plan files, real `.tfvars`, or sensitive logs. Git tracks directories only when files are present; README files represent extension points.

https://github-readme-insight-terminal-asci.vercel.app/svg/repo?repo=kbongcawel-viatrm/ai-stack&theme=mac
