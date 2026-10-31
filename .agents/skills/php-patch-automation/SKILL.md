---
name: php-patch-automation
description: Build, validate, and safely operate the Ansible-free multi-cloud PHP inventory and patch-orchestration starter in php-patch-automation/.
---

# PHP Patch Automation

Use this skill for changes to the PHP patch inventory, policy, AWS/Azure adapters, CI workflows, Codespaces setup, or operational documentation.

## Read first

- `php-patch-automation/README.md`
- `php-patch-automation/docs/architecture.md`
- `php-patch-automation/docs/cloud-setup.md`
- `php-patch-automation/docs/operations.md`
- `php-patch-automation/config/php-policy.yml`

## Current implementation boundaries

- Fixture inventory is runnable and is the default safe development path.
- AWS Systems Manager discovery reads managed-node metadata only.
- Azure Resource Graph discovery reads VM metadata only.
- Neither cloud adapter discovers PHP packages inside the guest OS. Never infer an installed PHP version from resource tags or OS metadata.
- No cloud patch mutation executor is implemented. The guarded patch workflow intentionally stops before any resource mutation.
- Cloud discovery workflows also block until read-only OIDC identity and an approved guest-runtime inventory source are configured.
- Container guidance requires rebuilding and redeploying immutable images; do not patch a running container or pod.
- Treat major/minor PHP branch changes as migrations requiring compatibility evidence and approvals, not routine patch updates.

Do not weaken these guards or claim production readiness. Implement provider-specific mutation only as a separately reviewed change with explicit authorization, least-privilege IAM/RBAC, BU scoping, approvals, health checks, and tested rollback.

## Development workflow

From the repository root:

```bash
cd php-patch-automation
make install
make validate
make discover-fixtures
```

The project requires Python 3.11 or newer. `make install` installs the development and AWS/Azure optional dependencies. Local Fedora Secureblue users should run development tooling inside Toolbox rather than modifying the immutable host.

## Implementation guidance

1. Preserve strict BU, environment, and patch-ring targeting. Missing filters must fail closed.
2. Keep inventory adapters read-only and normalize cloud records into the shared `Workload` model.
3. Keep cloud SDK imports lazy so fixture-only use does not require cloud SDK imports at module import time.
4. Validate policy and PHP version classification independently of cloud access.
5. Add tests for positive, negative, malformed, and boundary cases.
6. Keep credentials out of Git. Prefer GitHub OIDC and short-lived cloud credentials; separate read-only discovery identities from any future execution identity.
7. Use protected GitHub Environments for approvals, but do not treat environment approvals as a substitute for cloud IAM/RBAC.
8. Record exact commands and outcomes. Never claim that cloud execution, deployment, or tests succeeded unless actually verified.

## Validation

Run:

```bash
ruff check .
ruff format --check .
mypy src
pytest --cov=php_patch --cov-report=term-missing
php-patch validate-policy --policy config/php-policy.yml
php-patch inventory --source fixtures --format json
```

For workflow or devcontainer changes, inspect the affected YAML/JSON and confirm the workflow remains scoped to `php-patch-automation/**`. Do not apply Terraform, modify cloud resources, or enable patch execution as part of validation.

## References

Use the module's cloud setup and operations documents plus the official AWS Systems Manager, Azure Update Manager, GitHub Actions OIDC, Terraform, and Python documentation linked there.
