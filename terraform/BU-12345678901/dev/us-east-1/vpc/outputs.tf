output "vpc_id" {
  description = "ID of the BU VPC."
  value       = module.vpc.vpc_id
}

output "subnet_ids" {
  description = "Subnet IDs keyed by app, db, and public."
  value       = module.vpc.subnet_ids
}

output "nat_gateway_id" {
  description = "ID of the single NAT gateway."
  value       = module.vpc.nat_gateway_id
}

output "security_group_ids" {
  description = "Application and database security group IDs."
  value       = module.vpc.security_group_ids
}
