#!/usr/bin/env bash
# deploy.sh — provision AWS infrastructure and deploy all Lelu services to ECS Fargate.
#
# Prerequisites:
#   - AWS CLI v2 installed and configured (aws configure)
#   - Docker installed and running
#   - jq installed
#
# Usage:
#   export AWS_REGION=us-east-1
#   export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
#   bash infrastructure/aws/deploy.sh
#
set -euo pipefail

# Always run from the repo root regardless of where the script is invoked from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

# ─── Config ───────────────────────────────────────────────────────────────────

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
TAG="${IMAGE_TAG:-latest}"
CLUSTER="lelu"
VPC_CIDR="10.0.0.0/16"

log() { echo "[$(date +%H:%M:%S)] $*"; }

# ─── Step 1: ECR repositories ─────────────────────────────────────────────────

log "Creating ECR repositories..."
for svc in lelu-engine lelu-platform lelu-ui lelu-mcp; do
  aws ecr describe-repositories --repository-names "$svc" --region "$REGION" \
    > /dev/null 2>&1 || \
  aws ecr create-repository \
    --repository-name "$svc" \
    --image-scanning-configuration scanOnPush=true \
    --region "$REGION" \
    > /dev/null
  log "  ECR: $svc ready"
done

# ─── Step 2: Build and push images ────────────────────────────────────────────

log "Logging into ECR..."
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin \
    "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

ECR="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

build_push() {
  local name=$1 context=$2 dockerfile=$3
  log "Building $name..."
  docker build --network=host -t "$name:$TAG" -f "$dockerfile" "$context"
  docker tag "$name:$TAG" "$ECR/$name:$TAG"
  docker push "$ECR/$name:$TAG"
  log "  Pushed $ECR/$name:$TAG"
}

build_push lelu-engine   .           engine/Dockerfile
build_push lelu-platform platform    platform/Dockerfile
build_push lelu-ui       platform/ui platform/ui/Dockerfile
build_push lelu-mcp      sdk/mcp     sdk/mcp/Dockerfile

# ─── Step 3: VPC + Subnets + Security Groups ──────────────────────────────────

log "Setting up VPC..."
VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=tag:Name,Values=lelu-vpc" \
  --query "Vpcs[0].VpcId" --output text --region "$REGION" 2>/dev/null || echo "None")

if [ "$VPC_ID" = "None" ] || [ -z "$VPC_ID" ]; then
  VPC_ID=$(aws ec2 create-vpc --cidr-block "$VPC_CIDR" \
    --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=lelu-vpc}]" \
    --query "Vpc.VpcId" --output text --region "$REGION")
  aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-support --region "$REGION"
  aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-hostnames --region "$REGION"
  log "  Created VPC: $VPC_ID"
fi

# Public subnets (2 AZs for ALB)
AZ1="${REGION}a"
AZ2="${REGION}b"

create_subnet() {
  local name=$1 cidr=$2 az=$3
  local id
  id=$(aws ec2 describe-subnets \
    --filters "Name=tag:Name,Values=$name" "Name=vpc-id,Values=$VPC_ID" \
    --query "Subnets[0].SubnetId" --output text --region "$REGION" 2>/dev/null || echo "None")
  if [ "$id" = "None" ] || [ -z "$id" ]; then
    id=$(aws ec2 create-subnet --vpc-id "$VPC_ID" \
      --cidr-block "$cidr" --availability-zone "$az" \
      --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$name}]" \
      --query "Subnet.SubnetId" --output text --region "$REGION")
    log "  Created subnet $name: $id"
  fi
  echo "$id"
}

SUBNET_PUBLIC_1=$(create_subnet "lelu-public-1" "10.0.1.0/24" "$AZ1")
SUBNET_PUBLIC_2=$(create_subnet "lelu-public-2" "10.0.2.0/24" "$AZ2")
SUBNET_PRIVATE_1=$(create_subnet "lelu-private-1" "10.0.3.0/24" "$AZ1")
SUBNET_PRIVATE_2=$(create_subnet "lelu-private-2" "10.0.4.0/24" "$AZ2")

# Internet Gateway
IGW_ID=$(aws ec2 describe-internet-gateways \
  --filters "Name=tag:Name,Values=lelu-igw" "Name=attachment.vpc-id,Values=$VPC_ID" \
  --query "InternetGateways[0].InternetGatewayId" --output text --region "$REGION" 2>/dev/null || echo "None")
if [ "$IGW_ID" = "None" ] || [ -z "$IGW_ID" ]; then
  IGW_ID=$(aws ec2 create-internet-gateway \
    --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=lelu-igw}]" \
    --query "InternetGateway.InternetGatewayId" --output text --region "$REGION")
  aws ec2 attach-internet-gateway --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID" --region "$REGION"
  log "  Created IGW: $IGW_ID"
fi

# Security Groups
create_sg() {
  local name=$1 desc=$2
  local id
  id=$(aws ec2 describe-security-groups \
    --filters "Name=tag:Name,Values=$name" "Name=vpc-id,Values=$VPC_ID" \
    --query "SecurityGroups[0].GroupId" --output text --region "$REGION" 2>/dev/null || echo "None")
  if [ "$id" = "None" ] || [ -z "$id" ]; then
    id=$(aws ec2 create-security-group \
      --group-name "$name" --description "$desc" --vpc-id "$VPC_ID" \
      --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$name}]" \
      --query "GroupId" --output text --region "$REGION")
    log "  Created SG $name: $id"
  fi
  echo "$id"
}

SG_ALB=$(create_sg "lelu-alb-sg" "ALB — public HTTPS ingress")
SG_ECS=$(create_sg "lelu-ecs-sg" "ECS tasks — internal only")
SG_RDS=$(create_sg "lelu-rds-sg" "RDS — ECS tasks only")
SG_REDIS=$(create_sg "lelu-redis-sg" "Redis — ECS tasks only")

# Rules (idempotent — aws ec2 authorize returns an error if rule exists, which we ignore)
aws ec2 authorize-security-group-ingress --group-id "$SG_ALB" \
  --protocol tcp --port 443 --cidr 0.0.0.0/0 --region "$REGION" 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id "$SG_ALB" \
  --protocol tcp --port 80 --cidr 0.0.0.0/0 --region "$REGION" 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id "$SG_ECS" \
  --protocol tcp --port 0-65535 --source-group "$SG_ALB" --region "$REGION" 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id "$SG_ECS" \
  --protocol tcp --port 0-65535 --source-group "$SG_ECS" --region "$REGION" 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id "$SG_RDS" \
  --protocol tcp --port 5432 --source-group "$SG_ECS" --region "$REGION" 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id "$SG_REDIS" \
  --protocol tcp --port 6379 --source-group "$SG_ECS" --region "$REGION" 2>/dev/null || true

# ─── Step 4: RDS Postgres ─────────────────────────────────────────────────────

log "Provisioning RDS Postgres..."
DB_SUBNET_GROUP="lelu-db-subnet"
aws rds describe-db-subnet-groups --db-subnet-group-name "$DB_SUBNET_GROUP" \
  --region "$REGION" > /dev/null 2>&1 || \
aws rds create-db-subnet-group \
  --db-subnet-group-name "$DB_SUBNET_GROUP" \
  --db-subnet-group-description "Lelu RDS subnet group" \
  --subnet-ids "$SUBNET_PRIVATE_1" "$SUBNET_PRIVATE_2" \
  --region "$REGION" > /dev/null

aws rds describe-db-instances --db-instance-identifier "lelu-postgres" \
  --region "$REGION" > /dev/null 2>&1 || \
aws rds create-db-instance \
  --db-instance-identifier "lelu-postgres" \
  --db-instance-class "db.t3.micro" \
  --engine postgres \
  --engine-version "15" \
  --master-username lelu \
  --master-user-password "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}" \
  --db-name lelu \
  --allocated-storage 20 \
  --storage-type gp3 \
  --no-publicly-accessible \
  --vpc-security-group-ids "$SG_RDS" \
  --db-subnet-group-name "$DB_SUBNET_GROUP" \
  --backup-retention-period 7 \
  --deletion-protection \
  --region "$REGION" > /dev/null

log "  RDS instance created (takes ~5 min to become available)"

# ─── Step 5: ElastiCache Redis ────────────────────────────────────────────────

log "Provisioning ElastiCache Redis..."
REDIS_SUBNET_GROUP="lelu-redis-subnet"
aws elasticache describe-cache-subnet-groups --cache-subnet-group-name "$REDIS_SUBNET_GROUP" \
  --region "$REGION" > /dev/null 2>&1 || \
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name "$REDIS_SUBNET_GROUP" \
  --cache-subnet-group-description "Lelu Redis subnet group" \
  --subnet-ids "$SUBNET_PRIVATE_1" "$SUBNET_PRIVATE_2" \
  --region "$REGION" > /dev/null

aws elasticache describe-replication-groups --replication-group-id "lelu-redis" \
  --region "$REGION" > /dev/null 2>&1 || \
aws elasticache create-replication-group \
  --replication-group-id "lelu-redis" \
  --replication-group-description "Lelu human-review queue and token store" \
  --cache-node-type "cache.t3.micro" \
  --engine redis \
  --engine-version "7.0" \
  --num-cache-clusters 1 \
  --cache-subnet-group-name "$REDIS_SUBNET_GROUP" \
  --security-group-ids "$SG_REDIS" \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --region "$REGION" > /dev/null

log "  Redis cluster created (takes ~3 min to become available)"

# ─── Step 6: Secrets Manager ──────────────────────────────────────────────────

log "Creating Secrets Manager secrets..."
create_secret() {
  local name=$1 value=$2
  aws secretsmanager describe-secret --secret-id "lelu/$name" \
    --region "$REGION" > /dev/null 2>&1 || \
  aws secretsmanager create-secret \
    --name "lelu/$name" \
    --secret-string "$value" \
    --region "$REGION" > /dev/null
  log "  Secret: lelu/$name"
}

create_secret "jwt-signing-key"       "${JWT_SIGNING_KEY:?JWT_SIGNING_KEY is required}"
create_secret "api-key"               "${API_KEY:?API_KEY is required}"
create_secret "platform-api-key"      "${PLATFORM_API_KEY:?PLATFORM_API_KEY is required}"
create_secret "evidence-signing-key"  "${EVIDENCE_SIGNING_KEY:-$(openssl rand -hex 32)}"
# DATABASE_URL is set after RDS is available — see post-deploy note below

# ─── Step 7: CloudWatch Log Groups ────────────────────────────────────────────

log "Creating CloudWatch log groups..."
for svc in lelu-engine lelu-platform lelu-ui lelu-mcp; do
  aws logs create-log-group --log-group-name "/ecs/$svc" \
    --region "$REGION" 2>/dev/null || true
  aws logs put-retention-policy --log-group-name "/ecs/$svc" \
    --retention-in-days 30 --region "$REGION" 2>/dev/null || true
done

# ─── Step 8: IAM Roles ────────────────────────────────────────────────────────

log "Creating IAM roles..."

TRUST_POLICY='{
  "Version":"2012-10-17",
  "Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]
}'

create_role() {
  local name=$1
  aws iam get-role --role-name "$name" > /dev/null 2>&1 || \
  aws iam create-role --role-name "$name" \
    --assume-role-policy-document "$TRUST_POLICY" > /dev/null
}

create_role "lelu-ecs-execution-role"
aws iam attach-role-policy --role-name "lelu-ecs-execution-role" \
  --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy" 2>/dev/null || true

# Allow execution role to read secrets
aws iam put-role-policy --role-name "lelu-ecs-execution-role" \
  --policy-name "lelu-secrets-read" \
  --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{
      \"Effect\":\"Allow\",
      \"Action\":[\"secretsmanager:GetSecretValue\"],
      \"Resource\":\"arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:lelu/*\"
    }]
  }" 2>/dev/null || true

for svc in engine platform ui mcp; do
  create_role "lelu-${svc}-task-role"
done

# ─── Step 9: ECS Cluster ──────────────────────────────────────────────────────

log "Creating ECS cluster..."
aws ecs describe-clusters --clusters "$CLUSTER" --region "$REGION" \
  --query "clusters[0].status" --output text 2>/dev/null | grep -q ACTIVE || \
aws ecs create-cluster \
  --cluster-name "$CLUSTER" \
  --capacity-providers FARGATE FARGATE_SPOT \
  --region "$REGION" > /dev/null

# ─── Step 10: Register task definitions ───────────────────────────────────────

log "Registering ECS task definitions..."
for svc in engine platform ui mcp; do
  TASK_DEF="infrastructure/aws/task-definitions/${svc}.json"
  sed \
    -e "s|__ACCOUNT_ID__|${ACCOUNT_ID}|g" \
    -e "s|__REGION__|${REGION}|g" \
    -e "s|__TAG__|${TAG}|g" \
    -e "s|__REDIS_ENDPOINT__|${REDIS_ENDPOINT:-lelu-redis.internal}|g" \
    -e "s|__ENGINE_INTERNAL_URL__|${ENGINE_INTERNAL_URL:-http://engine.lelu.internal:8080}|g" \
    -e "s|__PLATFORM_INTERNAL_URL__|${PLATFORM_INTERNAL_URL:-http://platform.lelu.internal:9090}|g" \
    "$TASK_DEF" > /tmp/task-${svc}.json
  aws ecs register-task-definition --cli-input-json "file:///tmp/task-${svc}.json" \
    --region "$REGION" > /dev/null
  log "  Registered task: lelu-${svc}"
done

# ─── Step 11: ALB ─────────────────────────────────────────────────────────────

log "Creating Application Load Balancer..."
ALB_ARN=$(aws elbv2 describe-load-balancers --names "lelu-alb" \
  --query "LoadBalancers[0].LoadBalancerArn" --output text --region "$REGION" 2>/dev/null || echo "None")

if [ "$ALB_ARN" = "None" ] || [ -z "$ALB_ARN" ]; then
  ALB_ARN=$(aws elbv2 create-load-balancer \
    --name "lelu-alb" \
    --subnets "$SUBNET_PUBLIC_1" "$SUBNET_PUBLIC_2" \
    --security-groups "$SG_ALB" \
    --scheme internet-facing \
    --type application \
    --query "LoadBalancers[0].LoadBalancerArn" --output text --region "$REGION")
  log "  Created ALB: $ALB_ARN"
fi

# Target groups (one per service)
create_tg() {
  local name=$1 port=$2
  local arn
  arn=$(aws elbv2 describe-target-groups --names "$name" \
    --query "TargetGroups[0].TargetGroupArn" --output text --region "$REGION" 2>/dev/null || echo "None")
  if [ "$arn" = "None" ] || [ -z "$arn" ]; then
    arn=$(aws elbv2 create-target-group \
      --name "$name" --protocol HTTP --port "$port" \
      --vpc-id "$VPC_ID" --target-type ip \
      --health-check-path /healthz \
      --health-check-interval-seconds 10 \
      --healthy-threshold-count 2 \
      --query "TargetGroups[0].TargetGroupArn" --output text --region "$REGION")
    log "  Created target group $name: $arn"
  fi
  echo "$arn"
}

TG_ENGINE=$(create_tg   "lelu-engine-tg"   8080)
TG_PLATFORM=$(create_tg "lelu-platform-tg" 9090)
TG_UI=$(create_tg       "lelu-ui-tg"       3000)
TG_MCP=$(create_tg      "lelu-mcp-tg"      3001)

log ""
log "─────────────────────────────────────────────────────────────"
log "Infrastructure provisioned. Next steps:"
log ""
log "1. Wait for RDS (~5 min) then get its endpoint:"
log "   aws rds describe-db-instances --db-instance-identifier lelu-postgres \\"
log "     --query 'DBInstances[0].Endpoint.Address' --output text"
log ""
log "2. Store DATABASE_URL in Secrets Manager:"
log "   aws secretsmanager create-secret --name lelu/database-url \\"
log "     --secret-string 'postgres://lelu:PASSWORD@RDS_ENDPOINT:5432/lelu'"
log ""
log "3. Get Redis endpoint:"
log "   aws elasticache describe-replication-groups --replication-group-id lelu-redis \\"
log "     --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' --output text"
log ""
log "4. Create ECS services with the target groups above:"
log "   ENGINE TG:   $TG_ENGINE"
log "   PLATFORM TG: $TG_PLATFORM"
log "   UI TG:       $TG_UI"
log "   MCP TG:      $TG_MCP"
log ""
log "5. Point your DNS:"
log "   engine.lelu-ai.com  → ALB"
log "   app.lelu-ai.com     → ALB (UI path)"
log "   mcp.lelu-ai.com     → ALB (MCP path)"
log "─────────────────────────────────────────────────────────────"
