variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (staging | production)"
  type        = string
  default     = "production"
}

variable "project" {
  description = "Project name prefix used for all resource names"
  type        = string
  default     = "lelu"
}

# ── Networking ────────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "AZs to use (must be >= 2 for RDS multi-AZ)"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

# ── ECS ───────────────────────────────────────────────────────────────────────

variable "engine_image" {
  description = "ECR image URI for the Go authorization engine"
  type        = string
  default     = ""
}

variable "platform_image" {
  description = "ECR image URI for the Go platform API"
  type        = string
  default     = ""
}

variable "ui_image" {
  description = "ECR image URI for the Next.js dashboard"
  type        = string
  default     = ""
}

variable "mcp_image" {
  description = "ECR image URI for the MCP server"
  type        = string
  default     = ""
}

# ── Database ──────────────────────────────────────────────────────────────────

variable "db_instance_class" {
  description = "RDS instance type"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "lelu"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "lelu"
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL master password (use Secrets Manager in production)"
  type        = string
  sensitive   = true
}

# ── Cache ─────────────────────────────────────────────────────────────────────

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t4g.micro"
}

# ── TLS ───────────────────────────────────────────────────────────────────────

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for HTTPS on the ALB (must be in same region)"
  type        = string
  default     = ""
}

variable "domain" {
  description = "Primary domain (e.g. lelu-ai.com) — used for ALB listener rules"
  type        = string
  default     = "lelu-ai.com"
}
