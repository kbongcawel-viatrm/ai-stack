resource "azurerm_resource_group" "this" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags
}

module "network" {
  source = "../../../../modules/azure/vnet"

  name                           = "bu12345678902-dev"
  location                       = azurerm_resource_group.this.location
  resource_group_name            = azurerm_resource_group.this.name
  address_space                  = var.vnet_address_space
  bastion_subnet_prefix          = var.bastion_subnet_prefix
  app_subnet_prefix              = var.app_subnet_prefix
  private_endpoint_subnet_prefix = var.private_endpoint_subnet_prefix
  admin_ssh_cidrs                = var.admin_ssh_cidrs
  tags                           = var.tags
}

module "vm" {
  source = "../../../../modules/azure/vm"

  name                 = "bu12345678902-dev"
  location             = azurerm_resource_group.this.location
  resource_group_name  = azurerm_resource_group.this.name
  bastion_subnet_id    = module.network.bastion_subnet_id
  app_subnet_id        = module.network.app_subnet_id
  admin_username       = var.vm_admin_username
  admin_ssh_public_key = var.vm_admin_ssh_public_key
  vm_size              = var.vm_size
  tags                 = var.tags
}

module "sql_serverless" {
  source = "../../../../modules/azure/sql-serverless"

  name                        = "bu12345678902-dev"
  server_name                 = var.sql_server_name
  database_name               = var.sql_database_name
  resource_group_name         = azurerm_resource_group.this.name
  location                    = azurerm_resource_group.this.location
  virtual_network_id          = module.network.virtual_network_id
  private_endpoint_subnet_id  = module.network.private_endpoint_subnet_id
  administrator_login         = var.sql_admin_username
  administrator_password      = var.sql_admin_password
  sku_name                    = var.sql_sku_name
  min_capacity                = var.sql_min_capacity
  auto_pause_delay_in_minutes = var.sql_auto_pause_delay_minutes
  max_size_gb                 = var.sql_max_size_gb
  tags                        = var.tags
}
