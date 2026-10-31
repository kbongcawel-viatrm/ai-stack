# AWS VPC module

Creates one VPC with four subnets in four distinct Availability Zones:

- `app`: private subnet with outbound default route through the single NAT gateway
- `db` and `db_secondary`: isolated private subnets with no internet default route; intended for an Aurora DB subnet group
- `public`: public subnet with default route through the Internet Gateway

The module creates one Internet Gateway, one NAT gateway and Elastic IP, a public route table, an app-private route table, and an isolated database route table. It intentionally does not create workload security groups; those belong to the EC2 and Aurora modules.

## Inputs

- `name`: resource name prefix
- `vpc_cidr`: canonical VPC IPv4 CIDR
- `subnets`: exactly four objects keyed `app`, `db`, `db_secondary`, and `public`
- `tags`: common resource tags

## Outputs

- `vpc_id`
- `subnet_ids` keyed by subnet tier
- `nat_gateway_id`

## Availability and cost

This is a small development topology. It uses one NAT gateway, which is a single-AZ dependency and may create cross-AZ data transfer for the app subnet. The two database subnets are in separate AZs, as required for an Aurora DB subnet group, but they do not by themselves provide a standby database instance or database failover capacity.
