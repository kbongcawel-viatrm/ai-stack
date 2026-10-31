# AWS Terraform modules

Reusable AWS child modules live under this directory:

- `vpc/`: VPC, public/app/database subnets, Internet Gateway, and single NAT gateway
- `ec2/`: public bastion-server and private Nginx app-server, instance security groups, and SSM instance profile
- `aurora-serverless/`: private Aurora PostgreSQL Serverless v2 writer cluster and database security group

Each module documents its inputs and outputs and declares its provider requirements. BU roots call these modules using relative paths.

Do not put provider configurations or backend blocks in reusable child modules. Configure providers and remote state in the BU root.
