variable "name" {
  description = "Lowercase resource-name prefix."
  type        = string
}
variable "location" {
  description = "Azure region."
  type        = string
}
variable "resource_group_name" {
  description = "Existing resource group for the virtual machines."
  type        = string
}
variable "bastion_subnet_id" {
  description = "Subnet ID for the public bastion VM."
  type        = string
}
variable "app_subnet_id" {
  description = "Subnet ID for the private application VM."
  type        = string
}
variable "admin_username" {
  description = "Linux administrator username."
  type        = string
  default     = "azureuser"
}
variable "admin_ssh_public_key" {
  description = "OpenSSH public key installed on both VMs."
  type        = string
  sensitive   = true
}
variable "vm_size" {
  description = "Azure VM size."
  type        = string
  default     = "Standard_B1s"
}
variable "tags" {
  description = "Tags applied to virtual machine resources."
  type        = map(string)
  default     = {}
}
