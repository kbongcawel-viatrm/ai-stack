variable "name" {
  description = "Name prefix applied to VPC resources."
  type        = string
}

variable "vpc_cidr" {
  description = "Canonical IPv4 CIDR block for the VPC."
  type        = string
}

variable "subnets" {
  description = "Exactly three named subnets: app, db, and public."
  type = map(object({
    cidr_block        = string
    availability_zone = string
    public            = bool
  }))

  validation {
    condition = (
      length(var.subnets) == 3 &&
      alltrue([for name in ["app", "db", "public"] : contains(keys(var.subnets), name)])
    )
    error_message = "subnets must contain exactly app, db, and public."
  }

  validation {
    condition     = length(distinct([for subnet in values(var.subnets) : subnet.availability_zone])) == 3
    error_message = "app, db, and public subnets must use three distinct Availability Zones."
  }
}

variable "web_ingress_cidrs" {
  description = "IPv4 CIDR ranges allowed to reach app workloads on TCP 80 and 443."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "tags" {
  description = "Tags applied to all supported resources."
  type        = map(string)
  default     = {}
}
