output "bastion_vm_id" {
  description = "Bastion VM resource ID."
  value       = azurerm_linux_virtual_machine.bastion.id
}
output "bastion_public_ip" {
  description = "Bastion public IPv4 address."
  value       = azurerm_public_ip.bastion.ip_address
}
output "app_vm_id" {
  description = "Private application VM resource ID."
  value       = azurerm_linux_virtual_machine.app.id
}
output "app_private_ip" {
  description = "Private IPv4 address of the application VM."
  value       = azurerm_network_interface.app.private_ip_address
}
