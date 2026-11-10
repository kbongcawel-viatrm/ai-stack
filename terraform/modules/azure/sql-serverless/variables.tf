variable "name" {
  description = "Lowercase resource-name prefix."
  type        = string
}
variable "server_name" {
  description = "Globally unique lowercase Azure SQL logical server name."
  type        = string
}
variable "database_name" {
  description = "Azure SQL database name."
  type        = string
  default     = "appdb"
}
variable "resource_group_name" {
  description = "Existing resource group for SQL resources."
  type        = string
}
variable "location" {
  description = "Azure region."
  type        = string
}
variable "virtual_network_id" {
  description = "VNet ID for the private DNS link."
  type        = string
}
variable "private_endpoint_subnet_id" {
  description = "Subnet ID for the SQL private endpoint."
  type        = string
}
variable "administrator_login" {
  description = "SQL server administrator login."
  type        = string
}
variable "administrator_password" {
  description = "SQL server administrator password."
  type        = string
  sensitive   = true
}
variable "sku_name" {
  description = "Azure SQL serverless SKU."
  type        = string
  default     = "GP_S_Gen5_1"
}
variable "min_capacity" {
  description = "Minimum serverless vCore capacity."
  type        = number
  default     = 0.5
}
variable "auto_pause_delay_in_minutes" {
  description = "Minutes of inactivity before auto-pause; -1 disables auto-pause."
  type        = number
  default     = 60
}
variable "max_size_gb" {
  description = "Maximum database size in GiB."
  type        = number
  default     = 32
}
variable "tags" {
  description = "Tags applied to SQL resources."
  type        = map(string)
  default     = {}
}
