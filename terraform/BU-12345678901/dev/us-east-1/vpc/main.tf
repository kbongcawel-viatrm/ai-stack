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
    db_secondary = {
      cidr_block        = "10.0.4.0/24"
      availability_zone = var.availability_zones[3]
      public            = false
    }
  }

  tags = var.tags
}

module "ec2" {
  source = "../../../../modules/aws/ec2"

  name                      = "bu-12345678901-dev"
  vpc_id                    = module.vpc.vpc_id
  public_subnet_id          = module.vpc.subnet_ids["public"]
  app_subnet_id             = module.vpc.subnet_ids["app"]
  web_ingress_cidrs         = var.web_ingress_cidrs
  bastion_ssh_ingress_cidrs = var.bastion_ssh_ingress_cidrs
  instance_type             = var.ec2_instance_type
  ami_id                    = var.ec2_ami_id
  tags                      = var.tags
}

module "aurora" {
  source = "../../../../modules/aws/aurora-serverless"

  name               = "bu-12345678901-dev-aurora"
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = [
    module.vpc.subnet_ids["db"],
    module.vpc.subnet_ids["db_secondary"]
  ]

  application_security_group_id = module.ec2.app_security_group_id
  database_name                 = var.database_name
  master_username               = var.database_master_username
  engine_version                = var.aurora_engine_version
  min_capacity                  = var.aurora_min_capacity
  max_capacity                  = var.aurora_max_capacity
  tags                          = var.tags
}
