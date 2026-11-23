# ai-stack
<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Terraform</title><path d="M1.44 0v7.575l6.561 3.79V3.787zm21.12 4.227l-6.561 3.791v7.574l6.56-3.787zM8.72 4.23v7.575l6.561 3.787V8.018zm0 8.405v7.575L15.28 24v-7.578z"/></svg>[Terraform](https://img.shields.io/badge/terraform-844FBA)
<svg fill="#EE0000" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Ansible</title><path d="M10.617 11.473l4.686 3.695-3.102-7.662zM12 0C5.371 0 0 5.371 0 12s5.371 12 12 12 12-5.371 12-12S18.629 0 12 0zm5.797 17.305c-.011.471-.403.842-.875.83-.236 0-.416-.09-.664-.293l-6.19-5-2.079 5.203H6.191L11.438 5.44c.124-.314.427-.52.764-.506.326-.014.63.189.742.506l4.774 11.494c.045.111.08.234.08.348-.001.009-.001.009-.001.023z"/></svg>[Ansible](https://img.shields.io/badge/ansible-EE0000)

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
