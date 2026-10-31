module "vpc" {
  source = "../../../../modules/aws/vpc"

  name     = "bu-12345678901-dev"
  vpc_cidr = var.vpc_cidr

  subnets = {
    app = {
      cidr_block        = "10.0.1.0/24"
      availability_zone = var.availability_zones[0]
      public            = false
    }
    db = {
      cidr_block        = "10.0.2.0/24"
      availability_zone = var.availability_zones[1]
      public            = false
    }
    public = {
      cidr_block        = "10.0.3.0/24"
      availability_zone = var.availability_zones[2]
      public            = true
    }
  }

  web_ingress_cidrs = var.web_ingress_cidrs
  tags              = var.tags
}
