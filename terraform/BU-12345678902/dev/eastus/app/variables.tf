variable "resource_group_name" {
  description = "Resource group name for BU-12345678902 development."
  type        = string
  default     = "rg-bu-12345678902-dev"
}
variable "location" {
  description = "Azure region."
  type        = string
  default     = "eastus"
}
variable "vnet_address_space" {
  description = "VNet IPv4 CIDR."
  type        = string
  default     = "10.20.0.0/16"
}
variable "bastion_subnet_prefix" {
  description = "Bastion subnet IPv4 CIDR."
  type        = string
  default     = "10.20.1.0/24"
}
variable "app_subnet_prefix" {
  description = "Private application subnet IPv4 CIDR."
  type        = string
  default     = "10.20.2.0/24"
}
variable "private_endpoint_subnet_prefix" {
  description = "Private endpoint subnet IPv4 CIDR."
  type        = string
  default     = "10.20.3.0/24"
}
variable "admin_ssh_cidrs" {
  description = "IPv4 CIDRs permitted to SSH to the bastion. Empty disables public SSH."
  type        = list(string)
  default     = []
}
variable "vm_admin_username" {
  description = "Linux VM administrator username."
  type        = string
  default     = "azureuser"
}
variable "vm_admin_ssh_public_key" {
  description = "OpenSSH public key installed on both VMs."
  type        = string
  sensitive   = true
}
variable "vm_size" {
  description = "Azure VM size."
  type        = string
  default     = "Standard_B1s"
}
variable "sql_server_name" {
  description = "Globally unique lowercase Azure SQL logical server name; override before real deployment."
  type        = string
  default     = "bu12345678902-dev-sql"
}
variable "sql_database_name" {
  description = "Azure SQL database name."
  type        = string
  default     = "appdb"
}
variable "sql_admin_username" {
  description = "Azure SQL administrator login."
  type        = string
  default     = "sqladminuser"
}
variable "sql_admin_password" {
  description = "Azure SQL administrator password. Supply through TF_VAR_sql_admin_password or a secret variable file."
  type        = string
  sensitive   = true
}
variable "sql_sku_name" {
  description = "Azure SQL serverless SKU."
  type        = string
  default     = "GP_S_Gen5_1"
}
variable "sql_min_capacity" {
  description = "Minimum serverless vCore capacity."
  type        = number
  default     = 0.5
}
variable "sql_auto_pause_delay_minutes" {
  description = "Inactivity period before SQL auto-pause."
  type        = number
  default     = 60
}
variable "sql_max_size_gb" {
  description = "Maximum SQL database size in GiB."
  type        = number
  default     = 32
}
variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default = {
    business_unit = "BU-12345678902"
    environment   = "dev"
    managed_by    = "terraform"
  }
}
