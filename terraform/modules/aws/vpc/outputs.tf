output "vpc_id" {
  description = "ID of the VPC."
  value       = aws_vpc.this.id
}

output "subnet_ids" {
  description = "Subnet IDs keyed by app, db, and public."
  value       = { for name, subnet in aws_subnet.this : name => subnet.id }
}

output "nat_gateway_id" {
  description = "ID of the single NAT gateway."
  value       = aws_nat_gateway.this.id
}

output "security_group_ids" {
  description = "Application and database security group IDs."
  value = {
    app = aws_security_group.app.id
    db  = aws_security_group.db.id
  }
}
