output "bastion_instance_id" {
  description = "EC2 instance ID of bastion-server."
  value       = aws_instance.bastion.id
}

output "bastion_public_ip" {
  description = "Public IPv4 address of bastion-server."
  value       = aws_instance.bastion.public_ip
}

output "app_instance_id" {
  description = "EC2 instance ID of app-server."
  value       = aws_instance.app.id
}

output "app_private_ip" {
  description = "Private IPv4 address of app-server."
  value       = aws_instance.app.private_ip
}

output "bastion_security_group_id" {
  description = "Security group ID attached to bastion-server."
  value       = aws_security_group.bastion.id
}

output "app_security_group_id" {
  description = "Security group ID attached to app-server."
  value       = aws_security_group.app.id
}

output "ssm_instance_profile_name" {
  description = "Instance profile that enables Systems Manager Session Manager."
  value       = aws_iam_instance_profile.ssm.name
}
