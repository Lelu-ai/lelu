#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Lelu GCP Bootstrap — run ONCE to provision all infrastructure.
#
# Prerequisites:
#   gcloud CLI installed and authenticated  (gcloud auth login)
#   Billing account linked to the project
#
# Usage:
#   export GCP_PROJECT=your-project-id
#   export GCP_REGION=us-central1          # optional, defaults to us-central1
#   bash infrastructure/gcp/setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
PROJECT="${GCP_PROJECT:?Set GCP_PROJECT environment variable}"
REGION="${GCP_REGION:-us-central1}"
NETWORK="lelu-vpc"
SUBNET="lelu-subnet"
CONNECTOR="lelu-connector"
SQL_INSTANCE="lelu-postgres"
REDIS_INSTANCE="lelu-redis"
AR_REPO="lelu"
SA_DEPLOY="lelu-deployer"
SA_ENGINE="lelu-engine"
SA_PLATFORM="lelu-platform"
SA_UI="lelu-ui"
SA_MCP="lelu-mcp"

# ── Helpers ───────────────────────────────────────────────────────────────────
log() { echo "▶ $*"; }
section() { echo ""; echo "━━━ $* ━━━"; }

gcloud config set project "$PROJECT" --quiet

# ── 1. Enable required APIs ───────────────────────────────────────────────────
section "Enabling GCP APIs"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  vpcaccess.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --quiet
log "APIs enabled"

# ── 2. VPC network ────────────────────────────────────────────────────────────
section "VPC Network"
if ! gcloud compute networks describe "$NETWORK" --quiet &>/dev/null; then
  gcloud compute networks create "$NETWORK" \
    --subnet-mode=custom \
    --quiet
  gcloud compute networks subnets create "$SUBNET" \
    --network="$NETWORK" \
    --region="$REGION" \
    --range=10.8.0.0/20 \
    --quiet
  log "VPC network created: $NETWORK"
else
  log "VPC network already exists: $NETWORK"
fi

# ── 3. Serverless VPC Access Connector (Cloud Run → Memorystore) ──────────────
section "Serverless VPC Connector"
if ! gcloud compute networks vpc-access connectors describe "$CONNECTOR" \
      --region="$REGION" --quiet &>/dev/null; then
  gcloud compute networks vpc-access connectors create "$CONNECTOR" \
    --region="$REGION" \
    --network="$NETWORK" \
    --range=10.9.0.0/28 \
    --min-instances=2 \
    --max-instances=10 \
    --quiet
  log "VPC connector created: $CONNECTOR"
else
  log "VPC connector already exists: $CONNECTOR"
fi

# ── 4. Cloud SQL (PostgreSQL 15) ──────────────────────────────────────────────
section "Cloud SQL — PostgreSQL 15"
if ! gcloud sql instances describe "$SQL_INSTANCE" --quiet &>/dev/null; then
  gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region="$REGION" \
    --network="projects/$PROJECT/global/networks/$NETWORK" \
    --no-assign-ip \
    --quiet

  gcloud sql databases create lelu \
    --instance="$SQL_INSTANCE" \
    --quiet

  DB_PASSWORD="$(openssl rand -base64 32)"
  gcloud sql users create lelu \
    --instance="$SQL_INSTANCE" \
    --password="$DB_PASSWORD" \
    --quiet

  # Store connection string in Secret Manager
  CONN_STR="host=/cloudsql/${PROJECT}:${REGION}:${SQL_INSTANCE} user=lelu password=${DB_PASSWORD} dbname=lelu sslmode=disable"
  printf "%s" "$CONN_STR" | gcloud secrets create lelu-database-url \
    --data-file=- \
    --replication-policy=automatic \
    --quiet
  log "Cloud SQL instance created and secret stored"
else
  log "Cloud SQL instance already exists: $SQL_INSTANCE"
fi

# ── 5. Memorystore (Redis 7) ──────────────────────────────────────────────────
section "Memorystore — Redis 7"
if ! gcloud redis instances describe "$REDIS_INSTANCE" \
      --region="$REGION" --quiet &>/dev/null; then
  gcloud redis instances create "$REDIS_INSTANCE" \
    --size=1 \
    --region="$REGION" \
    --network="projects/$PROJECT/global/networks/$NETWORK" \
    --redis-version=redis_7_0 \
    --tier=BASIC \
    --quiet

  REDIS_IP=$(gcloud redis instances describe "$REDIS_INSTANCE" \
    --region="$REGION" --format="value(host)")
  REDIS_PORT=$(gcloud redis instances describe "$REDIS_INSTANCE" \
    --region="$REGION" --format="value(port)")
  REDIS_ADDR="${REDIS_IP}:${REDIS_PORT}"

  printf "%s" "$REDIS_ADDR" | gcloud secrets create lelu-redis-addr \
    --data-file=- \
    --replication-policy=automatic \
    --quiet
  log "Memorystore Redis created: $REDIS_ADDR"
else
  log "Memorystore Redis already exists: $REDIS_INSTANCE"
fi

# ── 6. Artifact Registry ──────────────────────────────────────────────────────
section "Artifact Registry"
if ! gcloud artifacts repositories describe "$AR_REPO" \
      --location="$REGION" --quiet &>/dev/null; then
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Lelu container images" \
    --quiet
  log "Artifact Registry repo created: $AR_REPO"
else
  log "Artifact Registry repo already exists: $AR_REPO"
fi

# ── 7. Secret Manager — application secrets ───────────────────────────────────
section "Secret Manager — application secrets"

create_secret_if_missing() {
  local name="$1"
  local prompt="$2"
  if ! gcloud secrets describe "$name" --quiet &>/dev/null; then
    echo ""
    printf "Enter value for secret [%s] (%s): " "$name" "$prompt"
    read -rs SECRET_VALUE
    echo ""
    printf "%s" "$SECRET_VALUE" | gcloud secrets create "$name" \
      --data-file=- \
      --replication-policy=automatic \
      --quiet
    log "Secret created: $name"
  else
    log "Secret already exists (skipping): $name"
  fi
}

create_secret_if_missing "lelu-jwt-signing-key"    "min 32 chars random string"
create_secret_if_missing "lelu-api-key"            "Bearer token for engine API"
create_secret_if_missing "lelu-platform-api-key"   "Bearer token for platform API"
create_secret_if_missing "lelu-evidence-signing-key" "optional, leave blank to skip"

# ── 8. Service accounts ───────────────────────────────────────────────────────
section "Service Accounts & IAM"

create_sa() {
  local sa="$1"; local display="$2"
  local email="${sa}@${PROJECT}.iam.gserviceaccount.com"
  if ! gcloud iam service-accounts describe "$email" --quiet &>/dev/null; then
    gcloud iam service-accounts create "$sa" --display-name="$display" --quiet
    log "Service account created: $email"
  else
    log "Service account already exists: $email"
  fi
  echo "$email"
}

# Deployer SA (used by CI/CD)
DEPLOY_EMAIL=$(create_sa "$SA_DEPLOY" "Lelu CI/CD Deployer")
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$DEPLOY_EMAIL" \
  --role="roles/run.admin" --quiet
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$DEPLOY_EMAIL" \
  --role="roles/artifactregistry.writer" --quiet
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$DEPLOY_EMAIL" \
  --role="roles/iam.serviceAccountUser" --quiet

# Engine SA
ENGINE_EMAIL=$(create_sa "$SA_ENGINE" "Lelu Engine Runtime")
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$ENGINE_EMAIL" \
  --role="roles/cloudsql.client" --quiet
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$ENGINE_EMAIL" \
  --role="roles/secretmanager.secretAccessor" --quiet

# Platform SA
PLATFORM_EMAIL=$(create_sa "$SA_PLATFORM" "Lelu Platform Runtime")
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$PLATFORM_EMAIL" \
  --role="roles/cloudsql.client" --quiet
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$PLATFORM_EMAIL" \
  --role="roles/secretmanager.secretAccessor" --quiet

# UI SA
UI_EMAIL=$(create_sa "$SA_UI" "Lelu UI Runtime")
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$UI_EMAIL" \
  --role="roles/secretmanager.secretAccessor" --quiet

# MCP SA
MCP_EMAIL=$(create_sa "$SA_MCP" "Lelu MCP Runtime")
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$MCP_EMAIL" \
  --role="roles/secretmanager.secretAccessor" --quiet

# ── 9. Workload Identity Federation (GitHub Actions keyless auth) ─────────────
section "Workload Identity Federation"
POOL="lelu-github-pool"
PROVIDER="lelu-github-provider"
GITHUB_REPO="${GITHUB_REPO:-}"  # e.g. "myorg/lelu"

if [[ -n "$GITHUB_REPO" ]]; then
  if ! gcloud iam workload-identity-pools describe "$POOL" \
        --location=global --quiet &>/dev/null; then
    gcloud iam workload-identity-pools create "$POOL" \
      --location=global \
      --display-name="GitHub Actions Pool" \
      --quiet

    gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
      --location=global \
      --workload-identity-pool="$POOL" \
      --display-name="GitHub OIDC Provider" \
      --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor" \
      --issuer-uri="https://token.actions.githubusercontent.com" \
      --quiet
    log "Workload Identity pool+provider created"
  fi

  POOL_RESOURCE="projects/$(gcloud projects describe $PROJECT --format='value(projectNumber)')/locations/global/workloadIdentityPools/$POOL"

  gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_EMAIL" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/${POOL_RESOURCE}/attribute.repository/${GITHUB_REPO}" \
    --quiet

  WIF_PROVIDER="${POOL_RESOURCE}/providers/${PROVIDER}"
  echo ""
  log "Add these secrets to your GitHub repository:"
  echo "  GCP_PROJECT_ID       = $PROJECT"
  echo "  GCP_REGION           = $REGION"
  echo "  GCP_WIF_PROVIDER     = $WIF_PROVIDER"
  echo "  GCP_SERVICE_ACCOUNT  = $DEPLOY_EMAIL"
else
  log "Skipping WIF setup (set GITHUB_REPO=org/repo to enable)"
fi

section "Setup complete"
echo "Next steps:"
echo "  1. Add GitHub repository secrets (see above)"
echo "  2. Push to main — the deploy-gcp.yml workflow handles the rest"
echo "  3. After first deploy, run: bash infrastructure/gcp/post-deploy.sh"
