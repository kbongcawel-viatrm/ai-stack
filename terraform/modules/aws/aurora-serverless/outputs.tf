output "cluster_id" {
  description = "Aurora DB cluster identifier."
  value       = aws_rds_cluster.this.id
}

output "cluster_endpoint" {
  description = "Aurora PostgreSQL writer endpoint."
  value       = aws_rds_cluster.this.endpoint
}

output "reader_endpoint" {
  description = "Aurora PostgreSQL reader endpoint."
  value       = aws_rds_cluster.this.reader_endpoint
}

output "port" {
  description = "Aurora PostgreSQL port."
  value       = aws_rds_cluster.this.port
}

output "security_group_id" {
  description = "Security group ID for Aurora PostgreSQL."
  value       = aws_security_group.this.id
}

output "master_user_secret_arn" {
  description = "Secrets Manager ARN for the AWS-managed master password."
  value       = try(aws_rds_cluster.this.master_user_secret[0].secret_arn, null)
}
