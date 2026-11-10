variable "name" {
  description = "Name prefix applied to EC2 resources."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where the EC2 instances and security groups are created."
  type        = string
}

variable "public_subnet_id" {
  description = "Public subnet ID for bastion-server."
  type        = string
}

variable "app_subnet_id" {
  description = "Private app subnet ID for app-server."
  type        = string
}

variable "ami_id" {
  description = "AMI ID or EC2 resolve:ssm reference for Amazon Linux 2023."
  type        = string
  default     = "resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

variable "instance_type" {
  description = "Instance type used by both EC2 instances."
  type        = string
  default     = "t3.micro"
}

variable "web_ingress_cidrs" {
  description = "IPv4 CIDRs allowed to reach TCP 80 and 443 on both EC2 security groups."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "bastion_ssh_ingress_cidrs" {
  description = "Optional IPv4 CIDRs allowed to SSH to bastion-server. Empty disables SSH; SSM Session Manager is enabled."
  type        = list(string)
  default     = []
}

variable "root_volume_size_gib" {
  description = "Encrypted gp3 root volume size for each EC2 instance."
  type        = number
  default     = 8

  validation {
    condition     = var.root_volume_size_gib >= 8
    error_message = "The EC2 root volume must be at least 8 GiB."
  }
}

variable "tags" {
  description = "Common tags applied to EC2 resources."
  type        = map(string)
  default     = {}
}
