variable "availability_zones" {
  description = "Four distinct AZs: app, primary DB, public, and secondary DB."
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c", "us-east-1d"]

  validation {
    condition     = length(var.availability_zones) == 4 && length(distinct(var.availability_zones)) == 4
    error_message = "Exactly four distinct Availability Zones are required."
  }
}

variable "vpc_cidr" {
  description = "Canonical CIDR for the VPC. 10.0.1.0/16 is non-canonical and is normalized to 10.0.0.0/16."
  type        = string
  default     = "10.0.0.0/16"
}

variable "web_ingress_cidrs" {
  description = "IPv4 sources allowed to reach HTTP/HTTPS on both EC2 security groups."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "bastion_ssh_ingress_cidrs" {
  description = "Optional IPv4 CIDRs allowed to SSH to the bastion. Empty by default; use SSM Session Manager."
  type        = list(string)
  default     = []
}

variable "ec2_instance_type" {
  description = "EC2 instance type for both the bastion and application server."
  type        = string
  default     = "t3.micro"
}

variable "ec2_ami_id" {
  description = "AMI ID or EC2 resolve:ssm reference for Amazon Linux 2023."
  type        = string
  default     = "resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

variable "database_name" {
  description = "Initial Aurora PostgreSQL database name."
  type        = string
  default     = "appdb"
}

variable "database_master_username" {
  description = "Aurora master username. AWS manages the password in Secrets Manager."
  type        = string
  default     = "dbadmin"
}

variable "aurora_engine_version" {
  description = "Optional Aurora PostgreSQL engine version. Null lets RDS select its regional default; pin a tested version for production."
  type        = string
  default     = null
}

variable "aurora_min_capacity" {
  description = "Aurora Serverless v2 minimum capacity in ACUs."
  type        = number
  default     = 0.5
}

variable "aurora_max_capacity" {
  description = "Aurora Serverless v2 maximum capacity in ACUs."
  type        = number
  default     = 2
}

variable "tags" {
  description = "Common tags for BU resources."
  type        = map(string)
  default = {
    BusinessUnit = "BU-12345678901"
    Environment  = "dev"
    ManagedBy    = "Terraform"
  }
}
