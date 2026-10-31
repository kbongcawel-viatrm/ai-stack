# AWS EC2 workload module

Creates:

- `bastion-server` in the public subnet, with a public IPv4 address
- `app-server` in the private app subnet, without a public IPv4 address
- Amazon Linux 2023 instances using the regional public SSM AMI parameter
- An EC2 IAM role/profile with `AmazonSSMManagedInstanceCore` for Session Manager
- Separate security groups for each instance
- Encrypted gp3 root volumes and IMDSv2-required metadata options

The app instance user data installs and starts Nginx and writes a small Hello World page to `/usr/share/nginx/html/index.html`.

## Security groups

Both instance security groups allow TCP 80 and 443 from `web_ingress_cidrs` (default `0.0.0.0/0`) and all outbound IPv4 traffic. The app security group additionally allows TCP 80 from the bastion security group so the bastion can test the private application endpoint.

SSH is disabled by default. Set `bastion_ssh_ingress_cidrs` to explicit trusted CIDRs only if SSH is required; prefer SSM Session Manager.

The app instance remains private. Its security group CIDR ingress does not make it Internet-reachable because it has no public IP and its subnet has no Internet Gateway route.

## Outputs

Instance IDs, bastion public IP, app private IP, both security group IDs, and the SSM instance profile name.
