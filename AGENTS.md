# Agent rules

- **Branch:** always work on and commit to the `devin` branch only. Before
  any commit, verify `git branch --show-current` is `devin`. Never commit
  to `main`, `mistral`, or any other branch unless the user explicitly
  overrides this rule.

- **vm-host provisioning:** always provision through the containerized
  pipeline (`make up` / `container/up.sh` inside `vm-host/`). Never
  hand-patch the guest to work around a provisioning defect — fix the
  `.bu`/unit/script source, commit, and reprovision so the running VM
  matches what the pipeline produces. Direct `deploy.sh` on the host is
  for debugging only, not the supported path.
