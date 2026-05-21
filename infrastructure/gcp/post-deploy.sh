#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Post-deploy — wires Cloud Run service URLs into ui and mcp after first deploy.
# Run once after the initial deploy-gcp.yml workflow completes.
#
# Usage:
#   export GCP_PROJECT=your-project-id
#   export GCP_REGION=us-central1
#   bash infrastructure/gcp/post-deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT="${GCP_PROJECT:?Set GCP_PROJECT}"
REGION="${GCP_REGION:-us-central1}"

log() { echo "▶ $*"; }

ENGINE_URL=$(gcloud run services describe lelu-engine \
  --region="$REGION" --format="value(status.url)")
PLATFORM_URL=$(gcloud run services describe lelu-platform \
  --region="$REGION" --format="value(status.url)")

log "Engine URL:   $ENGINE_URL"
log "Platform URL: $PLATFORM_URL"

log "Updating lelu-ui with service URLs..."
gcloud run services update lelu-ui \
  --region="$REGION" \
  --update-env-vars="LELU_ENGINE_URL=${ENGINE_URL},PLATFORM_URL=${PLATFORM_URL}" \
  --quiet

log "Updating lelu-mcp with engine URL..."
gcloud run services update lelu-mcp \
  --region="$REGION" \
  --update-env-vars="LELU_ENGINE_URL=${ENGINE_URL}" \
  --quiet

log "Done. All service URLs are now wired."
echo ""
echo "Service endpoints:"
gcloud run services list --region="$REGION" --filter="metadata.labels.app=lelu" \
  --format="table(metadata.name,status.url)"
