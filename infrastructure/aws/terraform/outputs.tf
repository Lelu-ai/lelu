output "alb_dns_name" {
  description = "ALB DNS name — point your domain's CNAME here"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "ALB hosted zone ID — use with Route 53 alias records"
  value       = aws_lb.main.zone_id
}

output "ecr_engine_url" {
  description = "ECR repository URL for the Go engine image"
  value       = aws_ecr_repository.engine.repository_url
}

output "ecr_platform_url" {
  description = "ECR repository URL for the platform image"
  value       = aws_ecr_repository.platform.repository_url
}

output "ecr_ui_url" {
  description = "ECR repository URL for the Next.js UI image"
  value       = aws_ecr_repository.ui.repository_url
}

output "ecr_mcp_url" {
  description = "ECR repository URL for the MCP server image"
  value       = aws_ecr_repository.mcp.repository_url
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (host:port)"
  value       = "${aws_db_instance.main.address}:${aws_db_instance.main.port}"
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = "${aws_elasticache_cluster.main.cache_nodes[0].address}:6379"
  sensitive   = true
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "secret_jwt_arn" {
  description = "Secrets Manager ARN for JWT signing key — paste your key here"
  value       = aws_secretsmanager_secret.jwt_signing_key.arn
}

output "secret_api_key_arn" {
  description = "Secrets Manager ARN for engine API key"
  value       = aws_secretsmanager_secret.api_key.arn
}
