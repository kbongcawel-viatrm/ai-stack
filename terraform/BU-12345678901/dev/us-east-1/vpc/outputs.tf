output "vpc_id" {
  description = "ID of the BU VPC."
  value       = module.vpc.vpc_id
}

output "subnet_ids" {
  description = "Subnet IDs keyed by app, db, db_secondary, and public."
  value       = module.vpc.subnet_ids
}

output "nat_gateway_id" {
  description = "ID of the single NAT gateway."
  value       = module.vpc.nat_gateway_id
}

output "bastion_instance_id" {
  description = "EC2 instance ID of bastion-server."
  value       = module.ec2.bastion_instance_id
}

output "bastion_public_ip" {
  description = "Public IPv4 address of bastion-server."
  value       = module.ec2.bastion_public_ip
}

output "app_instance_id" {
  description = "EC2 instance ID of app-server."
  value       = module.ec2.app_instance_id
}

output "app_private_ip" {
  description = "Private IPv4 address of app-server."
  value       = module.ec2.app_private_ip
}

output "app_url_from_bastion" {
  description = "HTTP URL to test from bastion-server."
  value       = "http://${module.ec2.app_private_ip}/"
}

output "bastion_security_group_id" {
  description = "Security group attached to bastion-server."
  value       = module.ec2.bastion_security_group_id
}

output "app_security_group_id" {
  description = "Security group attached to app-server."
  value       = module.ec2.app_security_group_id
}

output "aurora_cluster_endpoint" {
  description = "Aurora PostgreSQL writer endpoint."
  value       = module.aurora.cluster_endpoint
}

output "aurora_reader_endpoint" {
  description = "Aurora PostgreSQL reader endpoint."
  value       = module.aurora.reader_endpoint
}

output "aurora_master_secret_arn" {
  description = "Secrets Manager ARN for the AWS-managed Aurora master password."
  value       = module.aurora.master_user_secret_arn
}
