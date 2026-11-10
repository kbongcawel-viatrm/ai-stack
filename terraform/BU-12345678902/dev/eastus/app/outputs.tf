output "resource_group_name" {
  description = "Azure resource group name."
  value       = azurerm_resource_group.this.name
}
output "virtual_network_id" {
  description = "VNet resource ID."
  value       = module.network.virtual_network_id
}
output "bastion_vm_id" {
  description = "Bastion VM resource ID."
  value       = module.vm.bastion_vm_id
}
output "bastion_public_ip" {
  description = "Bastion public IPv4 address."
  value       = module.vm.bastion_public_ip
}
output "app_vm_id" {
  description = "Private application VM resource ID."
  value       = module.vm.app_vm_id
}
output "app_private_ip" {
  description = "Private application VM IPv4 address."
  value       = module.vm.app_private_ip
}
output "sql_server_fqdn" {
  description = "Azure SQL server FQDN; resolve through the VNet private DNS zone."
  value       = module.sql_serverless.fully_qualified_domain_name
}
output "sql_database_id" {
  description = "Azure SQL database resource ID."
  value       = module.sql_serverless.database_id
}
output "sql_private_endpoint_id" {
  description = "Azure SQL private endpoint resource ID."
  value       = module.sql_serverless.private_endpoint_id
}
