variable "name" {
  description = "Lowercase resource-name prefix."
  type        = string
}
variable "location" {
  description = "Azure region."
  type        = string
}
variable "resource_group_name" {
  description = "Existing resource group for the network resources."
  type        = string
}
variable "address_space" {
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
variable "tags" {
  description = "Tags applied to network resources."
  type        = map(string)
  default     = {}
}
