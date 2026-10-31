resource "aws_db_subnet_group" "this" {
  name        = var.name
  description = "Private multi-AZ subnet group for ${var.name}."
  subnet_ids  = var.private_subnet_ids

  tags = merge(var.tags, {
    Name = var.name
  })
}

resource "aws_security_group" "this" {
  name        = "${var.name}-db"
  description = "Allow PostgreSQL only from the application EC2 security group."
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from app-server"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.application_security_group_id]
  }

  egress {
    description = "Allow all outbound IPv4 traffic."
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.name}-db"
  })
}

resource "aws_rds_cluster" "this" {
  cluster_identifier = var.name
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = var.engine_version
  database_name      = var.database_name
  master_username    = var.master_username

  manage_master_user_password = true
  storage_encrypted           = true
  port                        = 5432

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.this.id]

  serverlessv2_scaling_configuration {
    min_capacity = var.min_capacity
    max_capacity = var.max_capacity
  }

  backup_retention_period      = 1
  deletion_protection          = var.deletion_protection
  skip_final_snapshot          = false
  final_snapshot_identifier    = "${var.name}-final"
  copy_tags_to_snapshot         = true

  tags = merge(var.tags, {
    Name = var.name
  })
}

resource "aws_rds_cluster_instance" "writer" {
  identifier         = "${var.name}-writer"
  cluster_identifier = aws_rds_cluster.this.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.this.engine
  engine_version     = aws_rds_cluster.this.engine_version

  db_subnet_group_name    = aws_db_subnet_group.this.name
  publicly_accessible     = false
  auto_minor_version_upgrade = true
  promotion_tier          = 0

  tags = merge(var.tags, {
    Name = "${var.name}-writer"
    Role = "writer"
  })
}
