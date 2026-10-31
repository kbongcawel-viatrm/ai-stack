output "server_id" {
  description = "Azure SQL logical server resource ID."
  value       = azurerm_mssql_server.this.id
}
output "server_name" {
  description = "Azure SQL logical server name."
  value       = azurerm_mssql_server.this.name
}
output "fully_qualified_domain_name" {
  description = "Azure SQL server FQDN."
  value       = azurerm_mssql_server.this.fully_qualified_domain_name
}
output "database_id" {
  description = "Azure SQL database resource ID."
  value       = azurerm_mssql_database.this.id
}
output "private_endpoint_id" {
  description = "SQL private endpoint resource ID."
  value       = azurerm_private_endpoint.sql.id
}
