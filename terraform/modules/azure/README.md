# Azure Terraform modules

Reusable Azure child modules live under this directory:

- vnet/: VNet, bastion/app/private-endpoint subnets, NSGs, and subnet associations
- vm/: public bastion and private Nginx application Linux VMs
- sql-serverless/: Azure SQL logical server, General Purpose serverless database, private endpoint, and private DNS integration

Each module includes its own provider requirements and documents its inputs and outputs. BU roots call these modules using relative paths.

Do not put provider configurations or backend blocks in reusable child modules. Configure providers and remote state in the BU root.
