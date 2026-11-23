# ai-stack
<svg fill="none" viewBox="0 0 600 80" width="600" height="80" xmlns="http://w3.org">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://w3.org">
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; text-shadow: 0 0 8px #ff0000; }
          50% { opacity: 0.4; text-shadow: none; }
        }
        .warn {
          font-family: monospace;
          color: #ff2a2a;
          font-size: 16px;
          font-weight: bold;
          animation: pulse 1.5s infinite;
        }
        .sub {
          font-family: monospace;
          color: #ff6b6b;
          font-size: 14px;
          margin-left: 20px;
        }
      </style>
      <div class="warn">⚠️ Warning:</div>
      <div class="sub">Made for mad science and breaking stuff.</div>
    </div>
  </foreignObject>
</svg>

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
