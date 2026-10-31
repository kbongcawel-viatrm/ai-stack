# BU-12345678901 dev VPC (Floci-only test root)

This root composes the reusable AWS VPC module for the BU VPC plan test.

## Network

- VPC: `10.0.0.0/16` (canonical network boundary; the originally supplied `10.0.1.0/16` is not canonical)
- App subnet: `10.0.1.0/24`, private, `us-east-1a`
- DB subnet: `10.0.2.0/24`, private, `us-east-1b`
- Public subnet: `10.0.3.0/24`, public, `us-east-1c`
- One NAT gateway in the public subnet
- Public default route through the Internet Gateway
- App and DB default routes through the NAT gateway
- App security group ingress: TCP 80 and 443 from `0.0.0.0/0`
- DB security group: no ingress rules until the database protocol/source is specified
- Both security groups allow all outbound IPv4 traffic

## Floci-only safety boundary

This root deliberately configures both the AWS provider and S3 backend to `http://localhost:4566`, with dummy credentials. Do not use this root for real AWS provisioning. The backend bucket and DynamoDB lock table are created by the dedicated Floci CI workflow.

The production BU deployment workflow does not select this root because the BU registry remains empty. This root is for the isolated Floci plan workflow only.

## State

- Backend: Floci-emulated S3
- Bucket: `floci-tfstate-bu-12345678901`
- Key: `BU-12345678901/dev/us-east-1/vpc/terraform.tfstate`
- Lock table: `tflock`

No apply is performed by the Floci workflow.
