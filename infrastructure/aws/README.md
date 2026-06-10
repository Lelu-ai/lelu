# Lelu — AWS Deployment (ECS Fargate)

Deploy the full Lelu stack on AWS using ECS Fargate, RDS PostgreSQL 15, ElastiCache Redis 7, and an Application Load Balancer.

## Architecture

```
Internet
   │
   └── Application Load Balancer (ALB)
          │
          ├── /v1/*  /healthz  ──► ECS Fargate: lelu-engine   (port 8080, Go)
          ├── /api/platform/*  ──► ECS Fargate: lelu-platform  (port 9090, Go)
          └── /*               ──► ECS Fargate: lelu-ui        (port 3000, Next.js)
                                            │
                                   ┌────────┴────────┐
                             RDS PostgreSQL 15   ElastiCache Redis 7
                             (platform DB,       (token store,
                              audit logs)         review queue)
```

All services run in **private subnets** behind NAT gateways. Only the ALB is public-facing.

---

## Prerequisites

- AWS CLI v2 configured (`aws configure`)
- Terraform >= 1.6 (`brew install terraform` / `apt install terraform`)
- Docker (to build and push images)

---

## Step 1 — Bootstrap Terraform

```bash
cd infrastructure/aws/terraform

# Copy and edit the variables file
cp terraform.tfvars.example terraform.tfvars
# Fill in: aws_region, db_password, acm_certificate_arn, domain

terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

Terraform creates:
- VPC with public + private subnets across 2 AZs
- NAT gateways, internet gateway, route tables
- ECS Fargate cluster with Container Insights enabled
- RDS PostgreSQL 15 (encrypted, 7-day backups, deletion protection)
- ElastiCache Redis 7
- Application Load Balancer with HTTPS listener
- ECR repositories for all 4 services
- Secrets Manager secrets (empty — you fill them next)
- IAM roles with least-privilege policies
- CloudWatch log groups (30-day retention for engine/platform)

---

## Step 2 — Push secrets into Secrets Manager

```bash
# JWT signing key (min 32 chars)
aws secretsmanager put-secret-value \
  --secret-id lelu-production/jwt-signing-key \
  --secret-string "$(openssl rand -hex 32)"

# Engine API key
aws secretsmanager put-secret-value \
  --secret-id lelu-production/api-key \
  --secret-string "$(openssl rand -hex 32)"

# Platform API key
aws secretsmanager put-secret-value \
  --secret-id lelu-production/platform-api-key \
  --secret-string "$(openssl rand -hex 32)"

# Database URL (get RDS endpoint from Terraform outputs)
ENGINE_HOST=$(terraform output -raw rds_endpoint)
aws secretsmanager put-secret-value \
  --secret-id lelu-production/database-url \
  --secret-string "postgres://lelu:<PASSWORD>@${ENGINE_HOST}/lelu?sslmode=require"
```

---

## Step 3 — Build and push Docker images to ECR

```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS \
    --password-stdin $(terraform output -raw ecr_engine_url | cut -d/ -f1)

# Engine (Go)
docker build -t lelu-engine ./engine
docker tag lelu-engine:latest $(terraform output -raw ecr_engine_url):latest
docker push $(terraform output -raw ecr_engine_url):latest

# Platform (Go)
docker build -t lelu-platform ./platform
docker tag lelu-platform:latest $(terraform output -raw ecr_platform_url):latest
docker push $(terraform output -raw ecr_platform_url):latest

# UI (Next.js)
docker build -t lelu-ui ./platform/ui
docker tag lelu-ui:latest $(terraform output -raw ecr_ui_url):latest
docker push $(terraform output -raw ecr_ui_url):latest
```

---

## Step 4 — Deploy ECS services

After images are in ECR, force a new deployment:

```bash
aws ecs update-service \
  --cluster lelu-production \
  --service lelu-production-engine \
  --force-new-deployment

aws ecs update-service \
  --cluster lelu-production \
  --service lelu-production-platform \
  --force-new-deployment

aws ecs update-service \
  --cluster lelu-production \
  --service lelu-production-ui \
  --force-new-deployment
```

Watch the rollout:
```bash
aws ecs wait services-stable \
  --cluster lelu-production \
  --services lelu-production-engine lelu-production-platform lelu-production-ui
```

---

## Step 5 — Point your domain to the ALB

```bash
# Get the ALB DNS name
terraform output alb_dns_name
```

In Route 53 (or your DNS provider), create a CNAME or alias record:
```
lelu-ai.com    →  <alb_dns_name>
api.lelu-ai.com → <alb_dns_name>
```

---

## Step 6 — Verify

```bash
ALB=$(terraform output -raw alb_dns_name)

# Engine health check
curl https://${ALB}/healthz

# Test authorization (sandbox key)
curl -X POST https://${ALB}/v1/authorize \
  -H "Authorization: Bearer lelu_sk_sandbox_test" \
  -H "Content-Type: application/json" \
  -d '{"tool":"read_customer_profile"}'
```

---

## CI/CD — GitHub Actions

Add these secrets to your GitHub repository:

| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM user access key (CI deploy user) |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `AWS_REGION` | `us-east-1` |
| `ECR_ENGINE_URL` | From `terraform output ecr_engine_url` |
| `ECS_CLUSTER` | `lelu-production` |

Then add `.github/workflows/deploy-aws.yml` — on push to `main`, build images, push to ECR, and call `aws ecs update-service --force-new-deployment`.

---

## Cost estimate (us-east-1, low traffic)

| Resource | Config | Monthly cost |
|---|---|---|
| ECS Fargate — engine | 0.5 vCPU / 1 GB, 1 task | ~$15 |
| ECS Fargate — platform | 0.5 vCPU / 1 GB, 1 task | ~$15 |
| ECS Fargate — ui | 0.5 vCPU / 1 GB, 1 task | ~$15 |
| RDS PostgreSQL | db.t4g.micro, 20 GB | ~$15 |
| ElastiCache Redis | cache.t4g.micro | ~$12 |
| ALB | 1 ALB | ~$16 |
| NAT Gateways | 2× (one per AZ) | ~$65 |
| ECR storage | ~1 GB images | ~$0.10 |
| CloudWatch Logs | 30-day retention | ~$3 |
| **Total** | | **~$156/month** |

> **With AWS Generative AI Accelerator credits ($1M):** run for years at no cost.
>
> To reduce cost in dev/staging: use a single NAT gateway, drop to 1 AZ, use `db.t4g.micro` spot, and set ECS desired count to 0 when idle.

---

## Secrets reference

| Secret Manager path | Used by | Description |
|---|---|---|
| `lelu-production/jwt-signing-key` | engine | JWT signing key (min 32 chars) |
| `lelu-production/api-key` | engine, ui, mcp | Bearer token for engine API |
| `lelu-production/platform-api-key` | platform, ui | Bearer token for platform API |
| `lelu-production/database-url` | platform | PostgreSQL connection string |
| `lelu-production/redis-addr` | engine | Redis host:port |
