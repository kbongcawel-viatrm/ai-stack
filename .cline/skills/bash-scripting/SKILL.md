---
name: bash-scripting
description: Design, review, test, and harden portable Bash scripts for Linux automation and operations.
---

# Bash scripting skill

## When to use
Shell automation, installers, service scripts, log rotation, health checks, filesystem synchronization, and operational tooling.

## Workflow
1. Inspect the repository conventions, supported shells, target OS, permissions, and execution context (root, run0, or unprivileged user).
2. Define inputs, outputs, exit codes, side effects, and failure behavior before coding.
3. Prefer Bash built-ins and standard tools; avoid unnecessary dependencies. Declare Bash explicitly with `#!/usr/bin/env bash`.
4. Use `set -Eeuo pipefail` when compatible with the script, but do not treat strict mode as a substitute for checking command outcomes.
5. Quote expansions; use arrays for argument lists; use `--` before untrusted path arguments where supported. Avoid `eval` and unsafe parsing of command output.
6. Validate arguments, required commands, paths, permissions, and privileges before making changes. Make operations idempotent when practical.
7. Use temporary files/directories safely with `mktemp` and cleanup traps. Do not leak secrets in logs, tracing, or error output.
8. Use explicit timeouts for network/service waits. Handle signals and partial failures without hiding the original exit status.
9. Include dry-run support for destructive or broad changes where practical. Require confirmation for destructive operations.
10. Document usage, dependencies, environment variables, exit codes, and rollback/recovery steps.

## Validation
- Run `bash -n path/to/script.sh`.
- Test normal, missing-input, invalid-input, missing-dependency, permission-denied, and command-failure paths.
- Use temporary directories and mocks for tests; do not test destructive commands against production paths.
- Run ShellCheck when available and address actionable findings.
- Check executable mode and inspect `git diff --check`.
- Report commands run and tests not run. Never claim execution was tested if only syntax was checked.

## Security
Do not disable SELinux, firewalld, or system security controls to make a script pass. Do not change broad permissions on system binaries. Avoid downloading and executing unverified remote scripts. Keep credentials out of command-line arguments where process listings or shell history may expose them.
