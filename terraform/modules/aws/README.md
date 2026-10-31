# AWS Terraform modules

Place reusable AWS child modules here (for example `vpc/`, `eks/`, and `s3/`). Each module should document its inputs and outputs and include `main.tf`, `variables.tf`, `outputs.tf`, and `versions.tf` as appropriate. BU roots should call these modules using relative paths such as `source = "../../../../modules/aws/vpc"` (adjust the relative path for the root depth).

Do not put provider configurations or backend blocks in reusable child modules. Configure providers and remote state in the BU root.
