variable "availability_zones" {
  description = "Three distinct Availability Zones for the app, db, and public subnets."
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]

  validation {
    condition     = length(var.availability_zones) == 3 && length(distinct(var.availability_zones)) == 3
    error_message = "Exactly three distinct Availability Zones are required."
  }
}

variable "vpc_cidr" {
  description = "Canonical CIDR for the VPC. 10.0.1.0/16 is non-canonical and is normalized to 10.0.0.0/16."
  type        = string
  default     = "10.0.0.0/16"
}

variable "web_ingress_cidrs" {
  description = "IPv4 sources allowed to reach application workloads on TCP 80 and 443."
  type        = list(string)
  default     = ["0.0.0.0/0"]
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
