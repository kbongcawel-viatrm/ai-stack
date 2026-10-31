# BU-12345678902 — Azure development stack

This root composes the reusable Azure modules under terraform/modules/azure and is intended for Terraform plan testing against Floci-AZ.

## Resources

- Resource group: rg-bu-12345678902-dev in eastus
- VNet: 10.20.0.0/16
- Bastion subnet: 10.20.1.0/24
- Private application subnet: 10.20.2.0/24
- Private endpoint subnet: 10.20.3.0/24
- Public bastion Linux VM with SSH disabled by default unless admin_ssh_cidrs is configured
- Private application Linux VM with Nginx cloud-init
- Azure SQL Database General Purpose Serverless, GP_S_Gen5_1, 0.5 minimum vCores and 60-minute auto-pause
- SQL private endpoint and privatelink.database.windows.net private DNS zone/link

The app subnet permits SSH and HTTP only from the bastion subnet. The SQL logical server has public network access disabled; application connectivity is intended to use the private endpoint.

## Inputs

Supply a real OpenSSH public key and a strong SQL administrator password through a protected variable file or environment variables. Do not commit either value.

~~~bash
export TF_VAR_vm_admin_ssh_public_key="$(cat ~/.ssh/id_ed25519.pub)"
read -rsp 'SQL admin password: ' TF_VAR_sql_admin_password
export TF_VAR_sql_admin_password
printf '\n'
~~~

## Floci-AZ plan

The root intentionally has no remote backend. CI uses ephemeral local state against Floci-AZ; no Azure subscription is contacted.

~~~bash
terraform init -backend=false
terraform fmt -check -diff -recursive .
terraform validate
terraform plan
~~~

The CI workflow supplies an ephemeral SSH key and a test-only SQL password. Its provider configuration uses the Floci-AZ custom cloud endpoint and dummy credentials; do not reuse it for real Azure deployments.

## Floci limitations

- VNet, subnet, NSG, NIC, public IP, VM and private endpoint resources are ARM control-plane emulation.
- VM resources are mocked by default. Floci does not boot a guest OS, execute cloud-init, inject SSH keys, or run Nginx.
- Azure SQL server/database resources are ARM-emulated by default. The default Floci SQL mode does not provide a real SQL Server data plane, and it does not prove serverless auto-pause, vCore scaling, SQL connectivity, or Azure private-link packet routing.
- A successful Terraform plan verifies provider interaction and resource graph planning only. It is not an Azure deployment test.

Before any real Azure deployment, use a separate production provider configuration with OIDC, a protected remote azurerm backend, a globally unique SQL server name, and an approved SSH ingress CIDR. Review the resulting plan before applying.
