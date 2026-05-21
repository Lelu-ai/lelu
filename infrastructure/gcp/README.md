# Lelu — GCP Cloud Run Deployment

This directory contains everything needed to migrate from Render to GCP Cloud Run.

## Architecture

```
Internet
   │
   ├── lelu-ui       (Cloud Run, port 3000) — Next.js dashboard
   ├── lelu-engine   (Cloud Run, port 8080) — Auth engine API
   ├── lelu-platform (Cloud Run, port 9090) — Control plane API
   └── lelu-mcp      (Cloud Run, port 3001) — MCP server
            │
            ├── Cloud SQL (PostgreSQL 15) — platform DB
            ├── Memorystore (Redis 7)     — token store, review queue
            └── Secret Manager            — all credentials
```

---

## Step-by-step migration

### Step 1 — GCP project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Note your **Project ID** (not the name — it looks like `my-project-123456`)
4. Make sure a billing account is linked: **Billing → Link a billing account**

### Step 2 — Install gcloud CLI

```bash
# macOS
brew install --cask google-cloud-sdk

# Linux
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Authenticate
gcloud auth login
```

### Step 3 — Run the bootstrap script

```bash
# Set your project ID
export GCP_PROJECT=your-project-id
export GCP_REGION=us-central1          # change if you prefer a different region
export GITHUB_REPO=your-org/lelu       # for Workload Identity Federation

bash infrastructure/gcp/setup.sh
```

This script creates:
- VPC network + Serverless VPC connector (for Redis access)
- Cloud SQL PostgreSQL 15 instance (`lelu-postgres`)
- Memorystore Redis 7 instance (`lelu-redis`)
- Artifact Registry repo (`lelu`)
- Secret Manager secrets (you will be prompted to enter values)
- Service accounts with least-privilege IAM roles
- Workload Identity Federation pool (keyless GitHub Actions auth)

> **Time**: ~10 minutes on first run (Cloud SQL takes longest).

### Step 4 — Add GitHub repository secrets

After the setup script prints the WIF values, add these secrets to your GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Value |
|-------------|-------|
| `GCP_PROJECT_ID` | Your GCP project ID |
| `GCP_WIF_PROVIDER` | Printed by setup.sh |
| `GCP_SERVICE_ACCOUNT` | `lelu-deployer@YOUR_PROJECT.iam.gserviceaccount.com` |

Also add this **variable** (not secret):
**Settings → Secrets and variables → Actions → Variables tab**

| Variable name | Value |
|---------------|-------|
| `GCP_REGION` | `us-central1` (or your region) |

### Step 5 — Add Dockerfiles for platform, ui, mcp

The engine already has a Dockerfile at `engine/Dockerfile`. You need similar files for:
- `platform/Dockerfile`
- `platform/ui/Dockerfile`
- `sdk/mcp/Dockerfile`

If those images are currently built by Render, pull the build commands from your Render dashboard and add the Dockerfiles.

### Step 6 — Trigger the first deployment

```bash
git push origin main
```

This triggers `.github/workflows/deploy-gcp.yml` which:
1. Builds all 4 Docker images and pushes to Artifact Registry
2. Deploys each service to Cloud Run in order (engine → platform → ui → mcp)
3. Wires service URLs between ui/mcp and engine/platform

Watch the progress at: **GitHub → Actions → Deploy to GCP Cloud Run**

### Step 7 — Wire service URLs (first deploy only)

After the first deploy, run:

```bash
export GCP_PROJECT=your-project-id
export GCP_REGION=us-central1
bash infrastructure/gcp/post-deploy.sh
```

This updates `lelu-ui` and `lelu-mcp` with the actual Cloud Run URLs of the engine and platform. Subsequent deploys do this automatically via the workflow.

### Step 8 — Verify

```bash
# List all services and their URLs
gcloud run services list --region=us-central1 --filter="metadata.labels.app=lelu"

# Test the engine health check
ENGINE_URL=$(gcloud run services describe lelu-engine --region=us-central1 --format="value(status.url)")
curl "${ENGINE_URL}/healthz"
```

### Step 9 — Remove Render

1. Go to your [Render dashboard](https://dashboard.render.com)
2. Delete the Lelu services (engine, platform, ui, mcp)
3. Remove the `RENDER_API_KEY` secret from GitHub repository secrets

---

## Ongoing deployments

Every push to `main` triggers a full rebuild and deploy of all 4 services.

To deploy only one service manually:
**GitHub → Actions → Deploy to GCP Cloud Run → Run workflow → select service**

---

## Cost estimate (us-central1, moderate traffic)

| Resource | Size | Monthly cost |
|----------|------|-------------|
| Cloud Run (engine, min 1 instance) | 1 vCPU / 512 MB | ~$15 |
| Cloud Run (platform, min 1 instance) | 1 vCPU / 512 MB | ~$15 |
| Cloud Run (ui + mcp, min 0) | scale-to-zero | ~$2 |
| Cloud SQL (db-f1-micro) | 0.6 vCPU / 614 MB | ~$10 |
| Memorystore (1 GB Basic) | — | ~$25 |
| Artifact Registry | image storage | ~$1 |
| **Total** | | **~$68/month** |

Upgrade Cloud SQL to `db-g1-small` or better for production load.

---

## Secrets reference

| Secret Manager name | Used by | Description |
|--------------------|---------|-------------|
| `lelu-jwt-signing-key` | engine | JWT signing key (min 32 chars) |
| `lelu-api-key` | engine, ui, mcp | Bearer token for engine API |
| `lelu-platform-api-key` | platform, ui | Bearer token for platform API |
| `lelu-database-url` | platform | PostgreSQL connection string |
| `lelu-redis-addr` | engine | Redis host:port |
| `lelu-evidence-signing-key` | platform | Optional evidence signing key |

Update any secret with:
```bash
echo -n "new-value" | gcloud secrets versions add SECRET_NAME --data-file=-
```
Cloud Run picks up the new version on the next deploy (or restart).

---

## Teardown

To delete all GCP resources:

```bash
export GCP_PROJECT=your-project-id
export GCP_REGION=us-central1

# Delete Cloud Run services
for svc in lelu-engine lelu-platform lelu-ui lelu-mcp; do
  gcloud run services delete "$svc" --region="$GCP_REGION" --quiet
done

# Delete Cloud SQL
gcloud sql instances delete lelu-postgres --quiet

# Delete Memorystore
gcloud redis instances delete lelu-redis --region="$GCP_REGION" --quiet

# Delete Artifact Registry
gcloud artifacts repositories delete lelu --location="$GCP_REGION" --quiet

# Delete secrets
for s in lelu-jwt-signing-key lelu-api-key lelu-platform-api-key \
         lelu-database-url lelu-redis-addr lelu-evidence-signing-key; do
  gcloud secrets delete "$s" --quiet 2>/dev/null || true
done

# Delete VPC connector
gcloud compute networks vpc-access connectors delete lelu-connector \
  --region="$GCP_REGION" --quiet
```
