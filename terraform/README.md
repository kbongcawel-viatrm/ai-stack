# BU-scoped Terraform

Terraform configurations are organized by business unit, environment, region, and component. Each component directory containing `main.tf` is an independent Terraform root and remote-state boundary.

```text
terraform/
├── modules/
│   ├── aws/<module>/
│   └── azure/<module>/
├── BU-<ID>/
│   └── <environment>/<region>/<component>/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       ├── providers.tf
│       ├── versions.tf
│       ├── backend.tf
│       ├── .terraform.lock.hcl
│       └── README.md
├── BU-TEMPLATE/                 # documentation-only template; never deployed
└── bu-targets.json              # explicit BU-to-cloud identity allowlist
```

## Adding a BU

1. Copy `BU-TEMPLATE` to the exact BU ID, for example `BU-12345678901`.
2. Add one or more roots under `<environment>/<region>/<component>`.
3. Add the Terraform configuration and a remote backend. Do not use local state.
4. Commit each root's `.terraform.lock.hcl`; generate it with the same Terraform version used by CI (`1.10.5`).
5. Add the BU to `bu-targets.json` only after its cloud identity and trust policy are provisioned.
6. Run **Actions → Terraform BU deployment**, enter the BU ID, and leave `apply` unchecked for a plan-only run.

## BU target registry

The registry starts empty intentionally. The workflow fails closed for unknown BU IDs and never derives account IDs, subscriptions, role ARNs, or identities from user input.

AWS entry:

```json
{
  "cloud": "aws",
  "aws": {
    "role_to_assume": "arn:aws:iam::123456789012:role/TerraformGitHubActions",
    "region": "us-east-1"
  }
}
```

Azure entry:

```json
{
  "cloud": "azure",
  "azure": {
    "client_id": "00000000-0000-0000-0000-000000000000",
    "tenant_id": "00000000-0000-0000-0000-000000000000",
    "subscription_id": "00000000-0000-0000-0000-000000000000"
  }
}
```

Place the selected entry under `targets["BU-<ID>"]`. These IDs and ARNs are identifiers, not secrets. Configure OIDC trust to restrict the repository and workflow/environment subject; do not add static cloud credentials to GitHub secrets.

## Backend requirements

- AWS roots must use an S3 backend with `use_lockfile = true`, bucket versioning, encryption, and BU/environment/region/component-specific state keys. Native S3 lockfiles require Terraform 1.10 or later.
- Azure roots must use an `azurerm` backend with OIDC and Azure AD authentication, and a unique state key per root.

Example AWS backend (replace the bucket with the approved state bucket):

```hcl
terraform {
  backend "s3" {
    bucket       = "organization-terraform-state"
    key          = "BU-12345678901/dev/us-east-1/vpc/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
```

Example Azure backend (replace the storage resources with the approved state account):

```hcl
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "orgtfstate"
    container_name       = "tfstate"
    key                  = "BU-12345678901/dev/eastus/vnet.tfstate"
    use_oidc              = true
    use_azuread_auth      = true
  }
}
```

Keep backend resource names and state keys non-secret. The backend infrastructure must exist before the workflow runs.

- Backend storage must be provisioned separately and protected from the workload being managed. Grant only the minimum state and lock permissions.
- Never commit state files, plan files, `.terraform/`, real `.tfvars`, credentials, or secrets.

## Workflow dependencies

The GitHub-hosted Ubuntu runner installs `jq` explicitly in the BU-resolution job. The plan and apply jobs install the pinned Terraform CLI (`1.10.5`) with `hashicorp/setup-terraform` and verify the installation before use. Terraform `init` downloads the provider plugins declared by each root; the committed `.terraform.lock.hcl` pins their selections.

The workflow also uses the Ubuntu runner's standard Bash, GNU find/coreutils, `tar`, and `gzip` utilities. AWS and Azure authentication is handled by their respective GitHub Actions using OIDC; static cloud credentials and separate cloud CLI installations are not required by this workflow.

GitHub-hosted jobs use separate ephemeral runners, so each job installs or verifies its own tools rather than relying on files installed by another job.

## Workflow behavior and safety

- The workflow is manually dispatched and accepts only a BU ID and an `apply` boolean.
- It discovers every root under that BU and runs formatting, initialization, validation, and planning for each root.
- Plans are saved as binary plan files and uploaded as a one-day artifact. Treat these artifacts as sensitive because plans can contain secret values.
- `apply` defaults to `false`. If enabled, the apply job waits for the `terraform-apply` GitHub Environment and applies the exact plans from the plan job; it does not create a new plan.
- Configure `terraform-apply` with required reviewers and restrict who can deploy to it. Merely referencing an Environment in YAML does not configure approval rules.
- The apply checkbox applies **all Terraform roots found under the selected BU**, across all environments and regions. Keep BU roots small and review every plan before approving.
- Runs are serialized per BU. Terraform backend locking additionally protects state from concurrent writers outside this workflow.

No BU mappings or deployable BU configurations are included yet. The workflow is therefore a fail-closed scaffold until those are added.
