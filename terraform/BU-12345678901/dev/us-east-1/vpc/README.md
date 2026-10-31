# BU-12345678901 dev application stack (Floci plan root)

This root composes the reusable VPC, EC2, and Aurora PostgreSQL Serverless v2 modules. It is currently configured only for the Floci AWS CI Plan workflow. It is not a real-AWS provisioning root.

## Network

- VPC: `10.0.0.0/16` (canonical boundary; `10.0.1.0/16` is not canonical)
- App subnet: `10.0.1.0/24`, private, `us-east-1a`
- Primary DB subnet: `10.0.2.0/24`, isolated private, `us-east-1b`
- Public subnet: `10.0.3.0/24`, public, `us-east-1c`
- Secondary DB subnet: `10.0.4.0/24`, isolated private, `us-east-1d`
- One NAT gateway in the public subnet
- Public default route through the Internet Gateway
- App default route through the NAT gateway
- Database subnets have no Internet/NAT default route and are supplied to the Aurora DB subnet group

The single NAT gateway is a development cost-saving choice and a single-AZ dependency. Production availability requirements may justify one NAT gateway per AZ.

## EC2

- `bastion-server`: Amazon Linux 2023, public subnet, public IP, SSM Session Manager enabled
- `app-server`: Amazon Linux 2023, private app subnet, no public IP
- App user data installs Nginx and serves `Hello, world!` at `/`
- Both EC2 security groups allow TCP 80 and 443 from `web_ingress_cidrs` (default `0.0.0.0/0`) and all outbound IPv4 traffic
- App security group also allows TCP 80 from the bastion security group
- SSH is disabled by default; use SSM Session Manager. Optional SSH ingress requires explicit `bastion_ssh_ingress_cidrs`

## Aurora PostgreSQL Serverless v2

- One `db.serverless` writer instance
- Default capacity range: 0.5–2 ACUs
- Encrypted storage and deletion protection enabled
- AWS-managed master password stored in Secrets Manager
- DB subnet group includes the two isolated DB subnets in separate AZs
- Database security group permits TCP 5432 only from the app-server security group
- No public database access

Only one writer instance is configured. The second subnet satisfies the multi-AZ DB subnet group requirement but does not create a standby reader or automatic database failover capacity. Add a Serverless reader instance if the required availability objective calls for it.

The Aurora engine version defaults to the regional RDS default when `aurora_engine_version = null`. Pin a tested Serverless v2-compatible engine version for production. ACU availability depends on engine version and Region.

## Test the HTTP response from bastion-server

After deploying these modules from a separate real-AWS BU root (with its approved AWS provider identity and remote backend), and after cloud-init has completed, obtain the app private IP and bastion instance ID from that deployment root:

```bash
terraform output -raw app_private_ip
terraform output -raw bastion_instance_id
```

This Floci-only root cannot provide real AWS instance outputs. Use the outputs from the real-AWS root that consumes these modules. Start a Session Manager shell from an operator workstation with AWS CLI and the Session Manager plugin configured:

```bash
aws ssm start-session --target "$(terraform output -raw bastion_instance_id)" --region us-east-1
```

Inside the bastion session, set `APP_PRIVATE_IP` to the value returned by the first Terraform output, then run:

```bash
set -euo pipefail
APP_PRIVATE_IP="10.0.1.123" # replace with terraform output -raw app_private_ip

HTTP_STATUS="$(curl --silent --show-error --output /tmp/hello-world.html --write-out '%{http_code}' "http://${APP_PRIVATE_IP}/")"
test "${HTTP_STATUS}" = "200"
grep -F "Hello, world!" /tmp/hello-world.html
printf 'HTTP %s\n' "${HTTP_STATUS}"
```

Expected output includes:

```text
<h1>Hello, world!</h1>
HTTP 200
```

The private app SG explicitly permits HTTP from the bastion SG. No public route to the app instance is created.

## Floci-only safety boundary

Both the AWS provider service endpoints and S3 backend point to `http://localhost:4566` with dummy credentials. Do not use this root for real AWS provisioning. The Floci AWS CI Plan workflow creates its own ephemeral backend bucket and DynamoDB lock table and runs formatting, init, validate, and plan only.

Floci can validate Terraform resource/API planning, but it does not boot EC2 guest operating systems, execute cloud-init/user data, install Nginx, create a real managed Aurora database, or provide VPC packet routing. Therefore the HTTP 200 check must be performed after a real AWS apply. No apply is included in the Floci workflow.

## State

- Backend: Floci-emulated S3
- Bucket: `floci-tfstate-bu-12345678901`
- Key: `BU-12345678901/dev/us-east-1/vpc/terraform.tfstate`
- Lock table: `tflock`
