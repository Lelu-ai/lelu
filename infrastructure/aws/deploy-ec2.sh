#!/usr/bin/env bash
# deploy-ec2.sh — Build & deploy all Lelu services to AWS EC2. No Docker needed.
#
# Usage:
#   export AWS_REGION=us-east-1
#   export POSTGRES_PASSWORD=...
#   export JWT_SIGNING_KEY=...
#   export API_KEY=...
#   export PLATFORM_API_KEY=...
#   bash infrastructure/aws/deploy-ec2.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/../.."
cd "$ROOT"

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
APP="lelu"
S3_BUCKET="$APP-artifacts-$ACCOUNT_ID"
INSTANCE_TYPE="t3.small"
TOTAL=8

# ── Colors ───────────────────────────────────────────────────────────────────
BOLD="\033[1m"; DIM="\033[2m"; GREEN="\033[32m"; YELLOW="\033[33m"
BLUE="\033[34m"; RED="\033[31m"; CYAN="\033[36m"; RESET="\033[0m"

banner() {
  echo
  echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}${CYAN}║   Lelu → AWS EC2 Deploy  (no Docker)        ║${RESET}"
  echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════╝${RESET}"
  echo
}

step() {
  local n=$1 msg=$2
  echo
  echo -e "${BOLD}${BLUE}━━━ [$n/$TOTAL] $msg ${RESET}"
  echo
}
ok()   { echo -e "  ${GREEN}✔${RESET}  $*"; }
info() { echo -e "  ${YELLOW}▸${RESET}  $*"; }
done_() { echo -e "\n${BOLD}${GREEN}✔ Done: $*${RESET}"; }

banner

# ─── Step 1: Build Go engine ──────────────────────────────────────────────────
step 1 "Build Go engine binary"
info "Compiling engine (Go, static binary)..."
cd engine
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -mod=vendor \
  -ldflags="-s -w -extldflags '-static'" \
  -o "$ROOT/dist/engine" ./cmd/engine
cd "$ROOT"
ok "engine → dist/engine  ($(du -sh dist/engine | cut -f1))"

# ─── Step 2: Build Go platform ────────────────────────────────────────────────
step 2 "Build Go platform binary"
info "Compiling platform (Go, static binary)..."
cd platform
GOTOOLCHAIN=local CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -mod=vendor \
  -ldflags="-s -w" \
  -o "$ROOT/dist/platform" ./cmd/api
cd "$ROOT"
ok "platform → dist/platform  ($(du -sh dist/platform | cut -f1))"

# ─── Step 3: Build MCP ────────────────────────────────────────────────────────
step 3 "Build MCP server (Node.js)"
info "Running npm install + build in sdk/mcp..."
cd sdk/mcp
npm install --silent 2>&1 | grep -v "^npm warn" || true
npm run build 2>&1 | tail -3
cd "$ROOT"
ok "MCP built → sdk/mcp/dist/"

# ─── Step 4: Package & upload to S3 ──────────────────────────────────────────
# Note: UI (Next.js) is deployed on Vercel — update PLATFORM_URL + LELU_ENGINE_URL
# in Vercel env vars after this deploy to point at the new AWS ALB.
step 4 "Package artifacts & upload to S3"

info "Creating S3 bucket: s3://$S3_BUCKET"
aws s3 mb "s3://$S3_BUCKET" --region "$REGION" 2>/dev/null \
  || info "Bucket already exists"

info "Packing engine + policy..."
# The engine loads its YAML policy from POLICY_PATH (default /etc/lelu/auth.yaml).
# Without it every agent scope is unknown, including the hosted cloud's
# cloud_customer, and every authorize call is denied. Ship config/auth.yaml
# inside the engine bundle; the service unit below points POLICY_PATH at it.
POLICY_FILE="$ROOT/config/auth.yaml"
[ -f "$POLICY_FILE" ] || { echo -e "${RED}✘ missing $POLICY_FILE${RESET}"; exit 1; }
tar czf dist/engine.tar.gz -C dist engine -C "$ROOT/config" auth.yaml
aws s3 cp dist/engine.tar.gz "s3://$S3_BUCKET/engine.tar.gz" --region "$REGION"
ok "s3://$S3_BUCKET/engine.tar.gz  (engine + auth.yaml)"

info "Packing platform..."
tar czf dist/platform.tar.gz -C dist platform
aws s3 cp dist/platform.tar.gz "s3://$S3_BUCKET/platform.tar.gz" --region "$REGION"
ok "s3://$S3_BUCKET/platform.tar.gz"

info "Packing MCP..."
tar czf dist/mcp.tar.gz -C sdk/mcp dist package.json
aws s3 cp dist/mcp.tar.gz "s3://$S3_BUCKET/mcp.tar.gz" --region "$REGION"
ok "s3://$S3_BUCKET/mcp.tar.gz"

ok "UI is on Vercel — update PLATFORM_URL + LELU_ENGINE_URL there after deploy"

# ─── Step 6: Networking ───────────────────────────────────────────────────────
step 5 "Provision VPC, subnets, security groups, ALB"

info "VPC..."
VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=tag:Name,Values=lelu-vpc" \
  --query "Vpcs[0].VpcId" --output text --region "$REGION" 2>/dev/null)

if [ "$VPC_ID" = "None" ] || [ -z "$VPC_ID" ]; then
  VPC_ID=$(aws ec2 create-vpc --cidr-block "10.0.0.0/16" \
    --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=lelu-vpc}]" \
    --query "Vpc.VpcId" --output text --region "$REGION")
  aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-support --region "$REGION"
  aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-hostnames --region "$REGION"
fi
ok "VPC: $VPC_ID"

create_subnet() {
  local name=$1 cidr=$2 az=$3
  local id
  id=$(aws ec2 describe-subnets \
    --filters "Name=tag:Name,Values=$name" "Name=vpc-id,Values=$VPC_ID" \
    --query "Subnets[0].SubnetId" --output text --region "$REGION" 2>/dev/null)
  if [ "$id" = "None" ] || [ -z "$id" ]; then
    id=$(aws ec2 create-subnet --vpc-id "$VPC_ID" \
      --cidr-block "$cidr" --availability-zone "$az" \
      --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$name}]" \
      --query "Subnet.SubnetId" --output text --region "$REGION")
  fi
  echo "$id"
}

info "Subnets..."
AZ1="${REGION}a"; AZ2="${REGION}b"
SUBNET_PUB1=$(create_subnet "lelu-public-1"  "10.0.1.0/24" "$AZ1")
SUBNET_PUB2=$(create_subnet "lelu-public-2"  "10.0.2.0/24" "$AZ2")
SUBNET_PRIV1=$(create_subnet "lelu-private-1" "10.0.3.0/24" "$AZ1")
SUBNET_PRIV2=$(create_subnet "lelu-private-2" "10.0.4.0/24" "$AZ2")
ok "Subnets: pub($SUBNET_PUB1,$SUBNET_PUB2) priv($SUBNET_PRIV1,$SUBNET_PRIV2)"

info "Internet Gateway..."
IGW_ID=$(aws ec2 describe-internet-gateways \
  --filters "Name=tag:Name,Values=lelu-igw" "Name=attachment.vpc-id,Values=$VPC_ID" \
  --query "InternetGateways[0].InternetGatewayId" --output text --region "$REGION" 2>/dev/null)
if [ "$IGW_ID" = "None" ] || [ -z "$IGW_ID" ]; then
  IGW_ID=$(aws ec2 create-internet-gateway \
    --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=lelu-igw}]" \
    --query "InternetGateway.InternetGatewayId" --output text --region "$REGION")
  aws ec2 attach-internet-gateway \
    --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID" --region "$REGION"
fi
ok "IGW: $IGW_ID"

info "Route table for public subnets..."
RTB_ID=$(aws ec2 describe-route-tables \
  --filters "Name=tag:Name,Values=lelu-public-rtb" "Name=vpc-id,Values=$VPC_ID" \
  --query "RouteTables[0].RouteTableId" --output text --region "$REGION" 2>/dev/null)
if [ "$RTB_ID" = "None" ] || [ -z "$RTB_ID" ]; then
  RTB_ID=$(aws ec2 create-route-table --vpc-id "$VPC_ID" \
    --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=lelu-public-rtb}]" \
    --query "RouteTable.RouteTableId" --output text --region "$REGION")
  aws ec2 create-route --route-table-id "$RTB_ID" \
    --destination-cidr-block "0.0.0.0/0" --gateway-id "$IGW_ID" --region "$REGION" > /dev/null
  aws ec2 associate-route-table --route-table-id "$RTB_ID" \
    --subnet-id "$SUBNET_PUB1" --region "$REGION" > /dev/null
  aws ec2 associate-route-table --route-table-id "$RTB_ID" \
    --subnet-id "$SUBNET_PUB2" --region "$REGION" > /dev/null
fi
ok "Route table: $RTB_ID"

info "Security groups..."
create_sg() {
  local name=$1 desc=$2
  local id
  id=$(aws ec2 describe-security-groups \
    --filters "Name=tag:Name,Values=$name" "Name=vpc-id,Values=$VPC_ID" \
    --query "SecurityGroups[0].GroupId" --output text --region "$REGION" 2>/dev/null)
  if [ "$id" = "None" ] || [ -z "$id" ]; then
    id=$(aws ec2 create-security-group \
      --group-name "$name" --description "$desc" --vpc-id "$VPC_ID" \
      --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$name}]" \
      --query "GroupId" --output text --region "$REGION")
  fi
  echo "$id"
}
SG_ALB=$(create_sg "lelu-alb-sg"  "ALB - public HTTP/HTTPS")
SG_EC2=$(create_sg "lelu-ec2-sg"  "EC2 - services")
SG_RDS=$(create_sg "lelu-rds-sg"  "RDS - Postgres")
SG_REDIS=$(create_sg "lelu-redis-sg" "Redis - cache")

aws ec2 authorize-security-group-ingress --group-id "$SG_ALB" \
  --protocol tcp --port 80   --cidr 0.0.0.0/0 --region "$REGION" 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id "$SG_ALB" \
  --protocol tcp --port 443  --cidr 0.0.0.0/0 --region "$REGION" 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id "$SG_EC2" \
  --protocol tcp --port 0-65535 --source-group "$SG_ALB" --region "$REGION" 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id "$SG_EC2" \
  --protocol tcp --port 22   --cidr 0.0.0.0/0 --region "$REGION" 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id "$SG_RDS" \
  --protocol tcp --port 5432 --source-group "$SG_EC2" --region "$REGION" 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id "$SG_REDIS" \
  --protocol tcp --port 6379 --source-group "$SG_EC2" --region "$REGION" 2>/dev/null || true
ok "Security groups: ALB=$SG_ALB  EC2=$SG_EC2  RDS=$SG_RDS  Redis=$SG_REDIS"

info "Application Load Balancer..."
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --names "lelu-alb" --query "LoadBalancers[0].LoadBalancerArn" \
  --output text --region "$REGION" 2>/dev/null || echo "None")
if [ "$ALB_ARN" = "None" ] || [ -z "$ALB_ARN" ]; then
  ALB_ARN=$(aws elbv2 create-load-balancer \
    --name "lelu-alb" --type application --scheme internet-facing \
    --subnets "$SUBNET_PUB1" "$SUBNET_PUB2" \
    --security-groups "$SG_ALB" \
    --query "LoadBalancers[0].LoadBalancerArn" --output text --region "$REGION")
fi
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns "$ALB_ARN" \
  --query "LoadBalancers[0].DNSName" --output text --region "$REGION")
ok "ALB: $ALB_DNS"

# ─── Step 7: RDS Postgres ────────────────────────────────────────────────────
step 6 "Provision RDS PostgreSQL"

DB_SUBNET_GROUP="lelu-db-subnet"
aws rds describe-db-subnet-groups --db-subnet-group-name "$DB_SUBNET_GROUP" \
  --region "$REGION" > /dev/null 2>&1 || \
aws rds create-db-subnet-group \
  --db-subnet-group-name "$DB_SUBNET_GROUP" \
  --db-subnet-group-description "Lelu DB subnets" \
  --subnet-ids "$SUBNET_PRIV1" "$SUBNET_PRIV2" \
  --region "$REGION" > /dev/null

aws rds describe-db-instances --db-instance-identifier "lelu-postgres" \
  --region "$REGION" > /dev/null 2>&1 || \
aws rds create-db-instance \
  --db-instance-identifier "lelu-postgres" \
  --db-instance-class "db.t3.micro" \
  --engine postgres --engine-version "15" \
  --master-username lelu \
  --master-user-password "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}" \
  --db-name lelu \
  --allocated-storage 20 --storage-type gp3 \
  --no-publicly-accessible \
  --vpc-security-group-ids "$SG_RDS" \
  --db-subnet-group-name "$DB_SUBNET_GROUP" \
  --backup-retention-period 7 \
  --deletion-protection \
  --region "$REGION" > /dev/null

info "Waiting for RDS to be available (this takes ~5 minutes)..."
aws rds wait db-instance-available \
  --db-instance-identifier "lelu-postgres" --region "$REGION"
DB_HOST=$(aws rds describe-db-instances \
  --db-instance-identifier "lelu-postgres" \
  --query "DBInstances[0].Endpoint.Address" --output text --region "$REGION")
ok "RDS ready: $DB_HOST"
DATABASE_URL="postgres://lelu:${POSTGRES_PASSWORD}@${DB_HOST}:5432/lelu"

# ─── Step 8: ElastiCache Redis ───────────────────────────────────────────────
step 7 "Provision ElastiCache Redis - cache"

REDIS_SUBNET_GROUP="lelu-redis-subnet"
aws elasticache describe-cache-subnet-groups \
  --cache-subnet-group-name "$REDIS_SUBNET_GROUP" \
  --region "$REGION" > /dev/null 2>&1 || \
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name "$REDIS_SUBNET_GROUP" \
  --cache-subnet-group-description "Lelu Redis subnets" \
  --subnet-ids "$SUBNET_PRIV1" "$SUBNET_PRIV2" \
  --region "$REGION" > /dev/null

aws elasticache describe-replication-groups \
  --replication-group-id "lelu-redis" --region "$REGION" > /dev/null 2>&1 || \
aws elasticache create-replication-group \
  --replication-group-id "lelu-redis" \
  --replication-group-description "Lelu queue/token store" \
  --cache-node-type "cache.t3.micro" \
  --engine redis --engine-version "7.0" \
  --num-cache-clusters 1 \
  --cache-subnet-group-name "$REDIS_SUBNET_GROUP" \
  --security-group-ids "$SG_REDIS" \
  --at-rest-encryption-enabled \
  --region "$REGION" > /dev/null

info "Waiting for Redis (this takes ~3 minutes)..."
aws elasticache wait replication-group-available \
  --replication-group-id "lelu-redis" --region "$REGION"
REDIS_HOST=$(aws elasticache describe-replication-groups \
  --replication-group-id "lelu-redis" \
  --query "ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address" \
  --output text --region "$REGION")
ok "Redis ready: $REDIS_HOST"

# ─── Step 9: Launch EC2 + deploy services ─────────────────────────────────────
step 8 "Launch EC2 instance & start all services"

info "Storing secrets in SSM Parameter Store..."
put_param() {
  local name=$1 value=$2
  aws ssm put-parameter --name "/lelu/$name" --value "$value" \
    --type SecureString --overwrite --region "$REGION" > /dev/null
}
put_param "jwt-signing-key"       "${JWT_SIGNING_KEY:?JWT_SIGNING_KEY required}"
put_param "api-key"               "${API_KEY:?API_KEY required}"
put_param "platform-api-key"      "${PLATFORM_API_KEY:?PLATFORM_API_KEY required}"
put_param "database-url"          "$DATABASE_URL"
put_param "redis-addr"            "${REDIS_HOST}:6379"
ok "Secrets stored in SSM /lelu/*"

info "Creating IAM role for EC2..."
aws iam get-role --role-name "lelu-ec2-role" > /dev/null 2>&1 || \
aws iam create-role --role-name "lelu-ec2-role" \
  --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }' > /dev/null
aws iam attach-role-policy --role-name "lelu-ec2-role" \
  --policy-arn "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore" 2>/dev/null || true
aws iam put-role-policy --role-name "lelu-ec2-role" \
  --policy-name "lelu-ec2-policy" \
  --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[
      {\"Effect\":\"Allow\",\"Action\":\"ssm:GetParameter\",\"Resource\":\"arn:aws:ssm:$REGION:$ACCOUNT_ID:parameter/lelu/*\"},
      {\"Effect\":\"Allow\",\"Action\":\"s3:GetObject\",\"Resource\":\"arn:aws:s3:::$S3_BUCKET/*\"}
    ]
  }" > /dev/null
aws iam get-instance-profile --instance-profile-name "lelu-ec2-profile" \
  > /dev/null 2>&1 || {
  aws iam create-instance-profile --instance-profile-name "lelu-ec2-profile" > /dev/null
  aws iam add-role-to-instance-profile \
    --instance-profile-name "lelu-ec2-profile" \
    --role-name "lelu-ec2-role" > /dev/null
  sleep 10  # IAM propagation
}
ok "IAM role + instance profile ready"

info "Finding latest Amazon Linux 2023 AMI..."
AMI=$(aws ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=al2023-ami-*-x86_64" \
             "Name=state,Values=available" \
  --query "sort_by(Images,&CreationDate)[-1].ImageId" \
  --output text --region "$REGION")
ok "AMI: $AMI"

# Enable public IPs on public subnets
aws ec2 modify-subnet-attribute \
  --subnet-id "$SUBNET_PUB1" --map-public-ip-on-launch --region "$REGION" 2>/dev/null || true

USER_DATA=$(cat <<USERDATA
#!/bin/bash
set -e

# Fetch secrets from SSM
get_param() { aws ssm get-parameter --name "/lelu/\$1" --with-decryption \
  --query "Parameter.Value" --output text --region $REGION; }

JWT_KEY=\$(get_param jwt-signing-key)
API_KEY=\$(get_param api-key)
PLATFORM_API_KEY=\$(get_param platform-api-key)
DATABASE_URL=\$(get_param database-url)
REDIS_ADDR=\$(get_param redis-addr)

# Install Node.js 20
dnf install -y nodejs npm 2>/dev/null || {
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  dnf install -y nodejs
}

# Create directories
mkdir -p /opt/lelu/{engine,platform,mcp}

# Download and extract artifacts
aws s3 cp s3://$S3_BUCKET/engine.tar.gz   /tmp/engine.tar.gz   --region $REGION
aws s3 cp s3://$S3_BUCKET/platform.tar.gz /tmp/platform.tar.gz --region $REGION
aws s3 cp s3://$S3_BUCKET/mcp.tar.gz      /tmp/mcp.tar.gz      --region $REGION

tar xzf /tmp/engine.tar.gz   -C /opt/lelu/engine
tar xzf /tmp/platform.tar.gz -C /opt/lelu/platform
tar xzf /tmp/mcp.tar.gz      -C /opt/lelu/mcp

chmod +x /opt/lelu/engine/engine /opt/lelu/platform/platform

# Install MCP dependencies
cd /opt/lelu/mcp && npm install --omit=dev --silent 2>/dev/null || true

# ── Systemd services ──────────────────────────────────────────────────────────
cat > /etc/systemd/system/lelu-engine.service <<EOF
[Unit]
Description=Lelu Authorization Engine
After=network.target

[Service]
ExecStart=/opt/lelu/engine/engine
Environment=PORT=8080
Environment=POLICY_PATH=/opt/lelu/engine/auth.yaml
Environment=LELU_MODE=enforce
Environment=CONFIDENCE_MISSING_MODE=deny
Environment=REDIS_ADDR=\${REDIS_ADDR}
Environment=JWT_SIGNING_KEY=\${JWT_KEY}
Environment=API_KEY=\${API_KEY}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/lelu-platform.service <<EOF
[Unit]
Description=Lelu Platform API
After=network.target

[Service]
ExecStart=/opt/lelu/platform/platform
Environment=LISTEN_ADDR=:9090
Environment=DATABASE_URL=\${DATABASE_URL}
Environment=PLATFORM_API_KEY=\${PLATFORM_API_KEY}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/lelu-mcp.service <<EOF
[Unit]
Description=Lelu MCP Server
After=network.target

[Service]
WorkingDirectory=/opt/lelu/mcp
ExecStart=/usr/bin/node dist/cli.js start
Environment=MCP_TRANSPORT=http
Environment=MCP_PORT=3001
Environment=LELU_ENGINE_URL=http://localhost:8080
Environment=LELU_API_KEY=\${API_KEY}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# UI is on Vercel — no local UI service needed

systemctl daemon-reload
systemctl enable --now lelu-engine lelu-platform lelu-mcp
echo "LELU_DEPLOY_DONE" >> /var/log/lelu-deploy.log
USERDATA
)

info "Launching EC2 instance ($INSTANCE_TYPE, Amazon Linux 2023)..."
EXISTING=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=lelu-server" \
            "Name=instance-state-name,Values=running,pending" \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text --region "$REGION" 2>/dev/null)

if [ "$EXISTING" != "None" ] && [ -n "$EXISTING" ]; then
  INSTANCE_ID="$EXISTING"
  info "Reusing existing instance: $INSTANCE_ID"
else
  INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AMI" \
    --instance-type "$INSTANCE_TYPE" \
    --subnet-id "$SUBNET_PUB1" \
    --security-group-ids "$SG_EC2" \
    --iam-instance-profile Name="lelu-ec2-profile" \
    --user-data "$USER_DATA" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=lelu-server}]" \
    --query "Instances[0].InstanceId" --output text --region "$REGION")
fi
ok "Instance launched: $INSTANCE_ID"

info "Waiting for instance to be running..."
aws ec2 wait instance-running \
  --instance-ids "$INSTANCE_ID" --region "$REGION"
INSTANCE_IP=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --query "Reservations[0].Instances[0].PublicIpAddress" \
  --output text --region "$REGION")
ok "Instance running: $INSTANCE_IP"

info "Setting up ALB target groups & listener..."
create_tg() {
  local name=$1 port=$2
  local arn
  arn=$(aws elbv2 describe-target-groups --names "$name" \
    --query "TargetGroups[0].TargetGroupArn" --output text --region "$REGION" 2>/dev/null || echo "None")
  if [ "$arn" = "None" ] || [ -z "$arn" ]; then
    arn=$(aws elbv2 create-target-group \
      --name "$name" --protocol HTTP --port "$port" --vpc-id "$VPC_ID" \
      --health-check-path "/healthz" \
      --query "TargetGroups[0].TargetGroupArn" --output text --region "$REGION")
  fi
  # Register EC2 instance
  aws elbv2 register-targets \
    --target-group-arn "$arn" \
    --targets "Id=$INSTANCE_ID,Port=$port" \
    --region "$REGION" > /dev/null
  echo "$arn"
}

TG_ENGINE=$(create_tg   "lelu-engine-tg"   8080)
TG_PLATFORM=$(create_tg "lelu-platform-tg" 9090)
TG_MCP=$(create_tg      "lelu-mcp-tg"      3001)
TG_UI=$(create_tg       "lelu-ui-tg"       3000)
ok "Target groups registered"

# Create HTTP listener with routing rules
LISTENER_ARN=$(aws elbv2 describe-listeners \
  --load-balancer-arn "$ALB_ARN" \
  --query "Listeners[?Port==\`80\`].ListenerArn" \
  --output text --region "$REGION" 2>/dev/null)
if [ -z "$LISTENER_ARN" ] || [ "$LISTENER_ARN" = "None" ]; then
  LISTENER_ARN=$(aws elbv2 create-listener \
    --load-balancer-arn "$ALB_ARN" \
    --protocol HTTP --port 80 \
    --default-actions "Type=forward,TargetGroupArn=$TG_UI" \
    --query "Listeners[0].ListenerArn" --output text --region "$REGION")
  # /v1/* → engine
  aws elbv2 create-rule \
    --listener-arn "$LISTENER_ARN" --priority 10 \
    --conditions '[{"Field":"path-pattern","Values":["/v1/*"]}]' \
    --actions "[{\"Type\":\"forward\",\"TargetGroupArn\":\"$TG_ENGINE\"}]" \
    --region "$REGION" > /dev/null
  # /api/* → platform
  aws elbv2 create-rule \
    --listener-arn "$LISTENER_ARN" --priority 20 \
    --conditions '[{"Field":"path-pattern","Values":["/api/*"]}]' \
    --actions "[{\"Type\":\"forward\",\"TargetGroupArn\":\"$TG_PLATFORM\"}]" \
    --region "$REGION" > /dev/null
  # /mcp/* → mcp
  aws elbv2 create-rule \
    --listener-arn "$LISTENER_ARN" --priority 30 \
    --conditions '[{"Field":"path-pattern","Values":["/mcp/*"]}]' \
    --actions "[{\"Type\":\"forward\",\"TargetGroupArn\":\"$TG_MCP\"}]" \
    --region "$REGION" > /dev/null
fi
ok "ALB listener + routing rules configured"

info "Waiting for services to start on EC2 (~2 min for user-data to complete)..."
for i in $(seq 1 24); do
  printf "  [%02d/24] checking..." "$i"
  STATUS=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters '{"commands":["systemctl is-active lelu-engine lelu-platform || echo not-ready"]}' \
    --query "Command.CommandId" --output text --region "$REGION" 2>/dev/null || echo "")
  if [ -n "$STATUS" ]; then
    sleep 5
    RESULT=$(aws ssm get-command-invocation \
      --command-id "$STATUS" --instance-id "$INSTANCE_ID" \
      --query "StandardOutputContent" --output text --region "$REGION" 2>/dev/null || echo "")
    if echo "$RESULT" | grep -q "^active"; then
      printf " services UP!\n"
      break
    fi
  fi
  printf " waiting...\n"
  sleep 5
done

echo
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║   🚀  Lelu is live on AWS!                          ║${RESET}"
echo -e "${BOLD}${GREEN}╠══════════════════════════════════════════════════════╣${RESET}"
echo -e "${BOLD}${GREEN}║                                                      ║${RESET}"
echo -e "${BOLD}${GREEN}║   Dashboard   http://$ALB_DNS${RESET}"
echo -e "${BOLD}${GREEN}║   Engine API  http://$ALB_DNS/v1/health${RESET}"
echo -e "${BOLD}${GREEN}║   Platform    http://$ALB_DNS/api/health${RESET}"
echo -e "${BOLD}${GREEN}║   EC2 IP      $INSTANCE_IP${RESET}"
echo -e "${BOLD}${GREEN}║                                                      ║${RESET}"
echo -e "${BOLD}${GREEN}║   Next: point lelu-ai.com DNS → $ALB_DNS${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════╝${RESET}"
echo
