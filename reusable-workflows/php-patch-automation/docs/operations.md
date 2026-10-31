# Operations runbook

## Local fixture checks

```bash
make install
make test
make lint
make discover-fixtures
```

Cloud discovery requires read-only federated identity and an approved guest runtime inventory source. Never infer installed PHP versions from tags.

## Before minor/security patching

- Confirm PHP branch and approved package source.
- Record current package versions, PHP SAPI, extensions, and service status.
- Confirm BU owner, maintenance window, health check, and rollback.
- Confirm redundant capacity and drain strategy.
- Patch a canary and inspect logs before widening rollout.

## Before major upgrades

- Require application-owner compatibility evidence.
- Validate framework, Composer dependencies, extensions, and configuration.
- Prefer parallel runtime/image deployment.
- Test synthetic transactions and critical workflows.
- Preserve the previous artifact/runtime and test traffic rollback.
- Never treat a major upgrade as an ordinary package update.

## Stop conditions

Stop rollout on failed canary health checks, package dependency conflicts, PHP-FPM/web-server failure, breached latency/error thresholds, ambiguous target scope, or cloud command failures.

## Evidence

Retain change reference, approver, Git commit, workflow run, cloud execution ID, target resource IDs, before/after runtime and extension inventory, package output, service status, health results, and rollback/exception details.
