# AWS Aurora Serverless v2 module

Creates an Aurora PostgreSQL Serverless v2 cluster and one `db.serverless` writer instance.

- `engine_mode = provisioned` is required for Serverless v2; this is not Serverless v1.
- The DB subnet group receives at least two private subnet IDs in distinct AZs.
- The database is not publicly accessible.
- The database security group permits TCP 5432 only from the application EC2 security group.
- Storage encryption and deletion protection are enabled.
- AWS manages the master password in Secrets Manager; Terraform does not accept or output a plaintext password.
- Default capacity range is 0.5–2 ACUs. Engine-version support and maximum capacity vary by engine version and Region; pin and verify a compatible engine version for production.

One writer instance is created. A second Serverless reader instance is not included, so this is not a multi-instance failover configuration. A multi-AZ DB subnet group is a placement prerequisite, not a substitute for a reader/standby.

## Inputs

- `name`, `vpc_id`, `private_subnet_ids`
- `application_security_group_id`
- `database_name`, `master_username`, optional `engine_version`
- `min_capacity`, `max_capacity`, `deletion_protection`, `tags`

## Outputs

Cluster ID, writer/reader endpoints, port, database security group ID, and the managed master-secret ARN.
