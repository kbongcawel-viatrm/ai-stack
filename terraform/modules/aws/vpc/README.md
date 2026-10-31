# AWS VPC module

Creates one VPC with exactly three subnets:

- `app`: private route through the NAT gateway
- `db`: private route through the NAT gateway
- `public`: default route through the Internet Gateway

The module creates one NAT gateway in the public subnet, an Elastic IP, separate public/private route tables, and app/database security groups. The app security group permits TCP 80 and 443 from `web_ingress_cidrs`; the database security group has no ingress rules until a database protocol and source are explicitly selected. Both groups allow outbound IPv4 traffic.

## Inputs

| Name | Description |
|---|---|
| `name` | Resource name prefix |
| `vpc_cidr` | Canonical VPC IPv4 CIDR |
| `subnets` | Exactly three subnet objects keyed `app`, `db`, and `public`; each includes CIDR, AZ, and public flag |
| `web_ingress_cidrs` | IPv4 CIDRs allowed to reach app workloads on TCP 80/443 |
| `tags` | Common resource tags |

## Outputs

- `vpc_id`
- `subnet_ids` keyed by subnet tier
- `nat_gateway_id`
- `security_group_ids.app` and `security_group_ids.db`

## Topology and limitations

This is the requested three-subnet, single-NAT topology, not a highly available production layout. Each subnet is in a distinct AZ; the NAT gateway is in the public subnet's AZ, so traffic from the other two AZs traverses AZ boundaries and the NAT gateway AZ is a dependency. A resilient production design normally uses one NAT gateway per AZ and multiple subnets per tier.

Floci records VPC, subnet, route, NAT gateway, Elastic IP, and security group resources, but it does not emulate VPC packet routing, NAT data-plane behavior, or NACL routing. A successful Floci plan validates Terraform/provider API interactions and resource graph construction, not real AWS network reachability.
