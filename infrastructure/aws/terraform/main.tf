terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment and configure for remote state:
  # backend "s3" {
  #   bucket         = "lelu-terraform-state"
  #   key            = "infra/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "lelu-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

locals {
  name = "${var.project}-${var.environment}"
}

# ── VPC ───────────────────────────────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${local.name}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name}-igw" }
}

resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true
  tags                    = { Name = "${local.name}-public-${count.index + 1}" }
}

resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = var.availability_zones[count.index]
  tags              = { Name = "${local.name}-private-${count.index + 1}" }
}

resource "aws_eip" "nat" {
  count  = length(var.availability_zones)
  domain = "vpc"
  tags   = { Name = "${local.name}-nat-eip-${count.index + 1}" }
}

resource "aws_nat_gateway" "main" {
  count         = length(var.availability_zones)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  tags          = { Name = "${local.name}-nat-${count.index + 1}" }
  depends_on    = [aws_internet_gateway.main]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "${local.name}-public-rt" }
}

resource "aws_route_table_association" "public" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }
  tags = { Name = "${local.name}-private-rt-${count.index + 1}" }
}

resource "aws_route_table_association" "private" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# ── Security groups ───────────────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "ALB — allow inbound HTTP/HTTPS from internet"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs" {
  name        = "${local.name}-ecs"
  description = "ECS tasks — allow traffic from ALB only"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "rds" {
  name        = "${local.name}-rds"
  description = "RDS — allow PostgreSQL from ECS tasks only"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }
}

resource "aws_security_group" "redis" {
  name        = "${local.name}-redis"
  description = "ElastiCache — allow Redis from ECS tasks only"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }
}

# ── ECR repositories ──────────────────────────────────────────────────────────

resource "aws_ecr_repository" "engine" {
  name                 = "${local.name}-engine"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
}

resource "aws_ecr_repository" "platform" {
  name                 = "${local.name}-platform"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
}

resource "aws_ecr_repository" "ui" {
  name                 = "${local.name}-ui"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
}

resource "aws_ecr_repository" "mcp" {
  name                 = "${local.name}-mcp"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
}

# ── RDS PostgreSQL ────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "main" {
  identifier             = "${local.name}-postgres"
  engine                 = "postgres"
  engine_version         = "15"
  instance_class         = var.db_instance_class
  allocated_storage      = 20
  max_allocated_storage  = 100
  db_name                = var.db_name
  username               = var.db_username
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  skip_final_snapshot    = false
  final_snapshot_identifier = "${local.name}-final-snapshot"
  deletion_protection    = true
  backup_retention_period = 7
  storage_encrypted      = true

  tags = { Name = "${local.name}-postgres" }
}

# ── ElastiCache Redis (token store + review queue) ────────────────────────────

resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name}-redis"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_cluster" "main" {
  cluster_id           = "${local.name}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]

  tags = { Name = "${local.name}-redis" }
}

# ── Secrets Manager ───────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "jwt_signing_key" {
  name        = "${local.name}/jwt-signing-key"
  description = "JWT signing key for Lelu engine (min 32 chars)"
}

resource "aws_secretsmanager_secret" "api_key" {
  name        = "${local.name}/api-key"
  description = "Bearer token for Lelu engine API"
}

resource "aws_secretsmanager_secret" "platform_api_key" {
  name        = "${local.name}/platform-api-key"
  description = "Bearer token for Lelu platform API"
}

# ── IAM — ECS task execution role ─────────────────────────────────────────────

resource "aws_iam_role" "ecs_execution" {
  name = "${local.name}-ecs-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_secrets" {
  name = "${local.name}-ecs-secrets"
  role = aws_iam_role.ecs_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.jwt_signing_key.arn,
        aws_secretsmanager_secret.api_key.arn,
        aws_secretsmanager_secret.platform_api_key.arn,
      ]
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "${local.name}-ecs-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# ── CloudWatch log groups ─────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "engine" {
  name              = "/ecs/${local.name}/engine"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "platform" {
  name              = "/ecs/${local.name}/platform"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "ui" {
  name              = "/ecs/${local.name}/ui"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "mcp" {
  name              = "/ecs/${local.name}/mcp"
  retention_in_days = 14
}

# ── ECS cluster ───────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "main" {
  name = local.name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

# ── ALB ───────────────────────────────────────────────────────────────────────

resource "aws_lb" "main" {
  name               = local.name
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  count             = var.acm_certificate_arn != "" ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ui.arn
  }
}

# ── Target groups ─────────────────────────────────────────────────────────────

resource "aws_lb_target_group" "engine" {
  name        = "${local.name}-engine"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    path                = "/healthz"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_target_group" "platform" {
  name        = "${local.name}-platform"
  port        = 9090
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    path                = "/healthz"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_target_group" "ui" {
  name        = "${local.name}-ui"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    path                = "/"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

# Route /v1/* and /healthz to the engine, /api/platform/* to platform, rest to ui
resource "aws_lb_listener_rule" "engine" {
  count        = var.acm_certificate_arn != "" ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.engine.arn
  }
  condition {
    path_pattern { values = ["/v1/*", "/healthz"] }
  }
}

resource "aws_lb_listener_rule" "platform" {
  count        = var.acm_certificate_arn != "" ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 20
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.platform.arn
  }
  condition {
    path_pattern { values = ["/api/platform/*"] }
  }
}

# ── ECS task definitions ──────────────────────────────────────────────────────

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

resource "aws_ecs_task_definition" "engine" {
  family                   = "${local.name}-engine"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "engine"
    image     = var.engine_image != "" ? var.engine_image : "${aws_ecr_repository.engine.repository_url}:latest"
    essential = true
    portMappings = [{ containerPort = 8080, protocol = "tcp" }]
    environment = [
      { name = "LISTEN_ADDR",                  value = ":8080" },
      { name = "POLICY_PATH",                  value = "/etc/lelu/auth.yaml" },
      { name = "LELU_MODE",                    value = "enforce" },
      { name = "CONFIDENCE_MISSING_MODE",      value = "deny" },
      { name = "CONFIDENCE_ALLOW_UNVERIFIED",  value = "false" },
      { name = "BEHAVIORAL_ANALYTICS_ENABLED", value = "true" },
      { name = "REDIS_ADDR",                   value = "${aws_elasticache_cluster.main.cache_nodes[0].address}:6379" },
    ]
    secrets = [
      {
        name      = "JWT_SIGNING_KEY"
        valueFrom = aws_secretsmanager_secret.jwt_signing_key.arn
      },
      {
        name      = "API_KEY"
        valueFrom = aws_secretsmanager_secret.api_key.arn
      },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.engine.name
        "awslogs-region"        = data.aws_region.current.name
        "awslogs-stream-prefix" = "engine"
      }
    }
    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://localhost:8080/healthz || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 10
    }
  }])
}

resource "aws_ecs_task_definition" "platform" {
  family                   = "${local.name}-platform"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "platform"
    image     = var.platform_image != "" ? var.platform_image : "${aws_ecr_repository.platform.repository_url}:latest"
    essential = true
    portMappings = [{ containerPort = 9090, protocol = "tcp" }]
    environment = [
      { name = "LISTEN_ADDR", value = ":9090" },
      { name = "ENGINE_URL",  value = "http://${local.name}-engine.${local.name}.local:8080" },
    ]
    secrets = [
      {
        name      = "DATABASE_URL"
        valueFrom = "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:${local.name}/database-url"
      },
      {
        name      = "PLATFORM_API_KEY"
        valueFrom = aws_secretsmanager_secret.platform_api_key.arn
      },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.platform.name
        "awslogs-region"        = data.aws_region.current.name
        "awslogs-stream-prefix" = "platform"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "ui" {
  family                   = "${local.name}-ui"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "ui"
    image     = var.ui_image != "" ? var.ui_image : "${aws_ecr_repository.ui.repository_url}:latest"
    essential = true
    portMappings = [{ containerPort = 3000, protocol = "tcp" }]
    environment = [
      { name = "ENGINE_URL",   value = "http://${local.name}-engine.${local.name}.local:8080" },
      { name = "NODE_ENV",     value = "production" },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ui.name
        "awslogs-region"        = data.aws_region.current.name
        "awslogs-stream-prefix" = "ui"
      }
    }
  }])
}

# ── ECS services ──────────────────────────────────────────────────────────────

resource "aws_ecs_service" "engine" {
  name            = "${local.name}-engine"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.engine.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.engine.arn
    container_name   = "engine"
    container_port   = 8080
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle { ignore_changes = [desired_count] }
}

resource "aws_ecs_service" "platform" {
  name            = "${local.name}-platform"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.platform.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.platform.arn
    container_name   = "platform"
    container_port   = 9090
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle { ignore_changes = [desired_count] }
}

resource "aws_ecs_service" "ui" {
  name            = "${local.name}-ui"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.ui.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ui.arn
    container_name   = "ui"
    container_port   = 3000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle { ignore_changes = [desired_count] }
}

# ── Auto-scaling (engine) ─────────────────────────────────────────────────────

resource "aws_appautoscaling_target" "engine" {
  max_capacity       = 10
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.engine.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "engine_cpu" {
  name               = "${local.name}-engine-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.engine.resource_id
  scalable_dimension = aws_appautoscaling_target.engine.scalable_dimension
  service_namespace  = aws_appautoscaling_target.engine.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 60.0
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
