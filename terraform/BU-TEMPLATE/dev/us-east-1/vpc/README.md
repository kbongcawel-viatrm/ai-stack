# BU Terraform root template

Copy `terraform/BU-TEMPLATE` to a real BU ID before adding deployable configuration. Replace this documentation-only directory with an environment/region/component root containing:

- `main.tf` — resources and module composition
- `variables.tf` / `outputs.tf` — explicit interface
- `providers.tf` / `versions.tf` — provider and Terraform constraints
- `backend.tf` — approved remote backend only
- `.terraform.lock.hcl` — committed provider selections
- `README.md` — purpose, dependencies, inputs, outputs, state key, and operational notes

Do not add credentials or real state/plan files. The `BU-TEMPLATE` path is explicitly excluded from workflow execution.
