variable "name" {
  description = "Aurora cluster identifier and resource name prefix."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for the Aurora security group."
  type        = string
}

variable "private_subnet_ids" {
  description = "At least two private subnet IDs in distinct Availability Zones."
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_ids) >= 2 && length(distinct(var.private_subnet_ids)) == length(var.private_subnet_ids)
    error_message = "Aurora requires at least two distinct private subnet IDs."
  }
}

variable "application_security_group_id" {
  description = "Application EC2 security group allowed to connect to PostgreSQL."
  type        = string
}

variable "database_name" {
  description = "Initial database name."
  type        = string
  default     = "appdb"
}

variable "master_username" {
  description = "Aurora master username; AWS manages the password in Secrets Manager."
  type        = string
  default     = "dbadmin"
}

variable "engine_version" {
  description = "Optional Aurora PostgreSQL engine version. Null uses the regional default."
  type        = string
  default     = null
}

variable "min_capacity" {
  description = "Aurora Serverless v2 minimum capacity in ACUs."
  type        = number
  default     = 0.5

  validation {
    condition     = var.min_capacity >= 0.5 && floor(var.min_capacity * 2) == var.min_capacity * 2
    error_message = "min_capacity must be at least 0.5 ACU and use 0.5 ACU increments."
  }
}

variable "max_capacity" {
  description = "Aurora Serverless v2 maximum capacity in ACUs."
  type        = number
  default     = 2

  validation {
    condition     = var.max_capacity >= var.min_capacity && floor(var.max_capacity * 2) == var.max_capacity * 2
    error_message = "max_capacity must be at least min_capacity and use 0.5 ACU increments."
  }
}

variable "deletion_protection" {
  description = "Protect the Aurora cluster from accidental deletion."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Common tags applied to Aurora resources."
  type        = map(string)
  default     = {}
}
