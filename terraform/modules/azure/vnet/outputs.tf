output "virtual_network_id" {
  description = "Virtual network resource ID."
  value       = azurerm_virtual_network.this.id
}
output "bastion_subnet_id" {
  description = "Bastion subnet resource ID."
  value       = azurerm_subnet.bastion.id
}
output "app_subnet_id" {
  description = "Private application subnet resource ID."
  value       = azurerm_subnet.app.id
}
output "private_endpoint_subnet_id" {
  description = "Private endpoint subnet resource ID."
  value       = azurerm_subnet.private_endpoint.id
}
output "app_subnet_prefix" {
  description = "Private application subnet IPv4 CIDR."
  value       = var.app_subnet_prefix
}
output "bastion_subnet_prefix" {
  description = "Bastion subnet IPv4 CIDR."
  value       = var.bastion_subnet_prefix
}
