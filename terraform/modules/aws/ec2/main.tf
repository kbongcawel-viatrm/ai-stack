locals {
  app_user_data = <<-USERDATA
    #!/bin/bash
    set -euxo pipefail

    dnf install -y nginx

    cat > /usr/share/nginx/html/index.html <<'HTML'
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Hello World</title>
      </head>
      <body>
        <h1>Hello, world!</h1>
      </body>
    </html>
    HTML

    systemctl enable --now nginx
    systemctl is-active --quiet nginx
  USERDATA
}

data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ssm" {
  name               = "${var.name}-ec2-ssm"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ssm.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ssm" {
  name = "${var.name}-ec2-ssm"
  role = aws_iam_role.ssm.name

  tags = var.tags
}

resource "aws_security_group" "bastion" {
  name        = "${var.name}-bastion-server"
  description = "Bastion web ingress on TCP 80/443; SSM Session Manager is used for administration."
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = toset([80, 443])

    content {
      description = "HTTP/HTTPS ingress"
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = var.web_ingress_cidrs
    }
  }

  dynamic "ingress" {
    for_each = toset(var.bastion_ssh_ingress_cidrs)

    content {
      description = "Optional restricted SSH administration"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  egress {
    description = "Allow all outbound IPv4 traffic."
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.name}-bastion-server"
    Role = "bastion"
  })
}

resource "aws_security_group" "app" {
  name        = "${var.name}-app-server"
  description = "HTTP/HTTPS ingress to app-server, including HTTP from bastion-server."
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = toset([80, 443])

    content {
      description = "HTTP/HTTPS ingress"
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = var.web_ingress_cidrs
    }
  }

  ingress {
    description     = "HTTP health/content check from bastion-server"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion.id]
  }

  egress {
    description = "Allow all outbound IPv4 traffic."
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.name}-app-server"
    Role = "application"
  })
}

resource "aws_instance" "bastion" {
  ami                         = var.ami_id
  instance_type               = var.instance_type
  subnet_id                   = var.public_subnet_id
  associate_public_ip_address = true
  iam_instance_profile        = aws_iam_instance_profile.ssm.name
  vpc_security_group_ids      = [aws_security_group.bastion.id]

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    encrypted             = true
    volume_type           = "gp3"
    volume_size           = var.root_volume_size_gib
    delete_on_termination = true
  }

  tags = merge(var.tags, {
    Name = "${var.name}-bastion-server"
    Role = "bastion"
  })

  depends_on = [aws_iam_role_policy_attachment.ssm]
}

resource "aws_instance" "app" {
  ami                         = var.ami_id
  instance_type               = var.instance_type
  subnet_id                   = var.app_subnet_id
  associate_public_ip_address = false
  iam_instance_profile        = aws_iam_instance_profile.ssm.name
  vpc_security_group_ids      = [aws_security_group.app.id]
  user_data                   = local.app_user_data
  user_data_replace_on_change = true

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    encrypted             = true
    volume_type           = "gp3"
    volume_size           = var.root_volume_size_gib
    delete_on_termination = true
  }

  tags = merge(var.tags, {
    Name = "${var.name}-app-server"
    Role = "application"
  })

  depends_on = [aws_iam_role_policy_attachment.ssm]
}
