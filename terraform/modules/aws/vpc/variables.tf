variable "name" {
  description = "Name prefix applied to VPC resources."
  type        = string
}

variable "vpc_cidr" {
  description = "Canonical IPv4 CIDR block for the VPC."
  type        = string
}

variable "subnets" {
  description = "Exactly four named subnets: app, db, db_secondary, and public."
  type = map(object({
    cidr_block        = string
    availability_zone = string
    public            = bool
  }))

  validation {
    condition = (
      length(var.subnets) == 4 &&
      alltrue([for name in ["app", "db", "db_secondary", "public"] : contains(keys(var.subnets), name)])
    )
    error_message = "subnets must contain exactly app, db, db_secondary, and public."
  }

  validation {
    condition     = length(distinct([for subnet in values(var.subnets) : subnet.availability_zone])) == 4
    error_message = "All four subnets must use distinct Availability Zones."
  }
}

variable "tags" {
  description = "Tags applied to all supported resources."
  type        = map(string)
  default     = {}
}
