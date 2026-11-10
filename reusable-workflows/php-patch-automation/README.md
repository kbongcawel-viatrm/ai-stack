# PHP Patch Automation

Ansible-free, multi-cloud PHP patch inventory and orchestration starter.

## Quick start in Codespaces

Open this repository, select **Code → Codespaces → Create codespace on main**, then run:

```bash
cd reusable-workflows/php-patch-automation
make install
make validate
make discover-fixtures
```

The devcontainer installs Python 3.11, Terraform CLI, GitHub CLI, and editor extensions. Local Fedora Toolbox users should install dependencies inside Toolbox, not on the immutable host.

## Scope and safety

- CI validates source and tests; it does not patch infrastructure.
- Fixture inventory is runnable immediately.
- Cloud inventory adapters are library functions; guest PHP discovery and BU tagging integration remain to be completed.
- Cloud patch execution is intentionally blocked in the starter workflow.
- Configure protected Environments named `inventory-readonly`, `patch-nonprod`, and `patch-production`.
- Configure AWS/Azure OIDC, least-privilege roles, maintenance windows, rollback, and health checks before implementing execution.
- Containers are rebuilt and redeployed; running containers are not patched in place.
- Major PHP upgrades are migrations, not routine package updates.

See `docs/` before connecting a production account.
