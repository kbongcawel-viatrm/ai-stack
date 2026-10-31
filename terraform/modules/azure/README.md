# Azure Terraform modules

Place reusable Azure child modules here (for example `vnet/`, `aks/`, and `storage/`). Each module should document its inputs and outputs and include `main.tf`, `variables.tf`, `outputs.tf`, and `versions.tf` as appropriate. BU roots should call these modules using relative paths adjusted for the root depth.

Do not put provider configurations or backend blocks in reusable child modules. Configure providers and remote state in the BU root.
