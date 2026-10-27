# Cline project configuration

Cline reads project-level agent files from `.cline/` (rules, skills, hooks, agents, and plugins) and also supports root-level `.clinerules/` rules. This repository keeps tool-neutral guidance in `.agents/` and provides Cline-facing rules in `.clinerules/`.

Use `cline auth` after installation to configure a model provider. Do not commit Cline's local session state or provider credentials.
