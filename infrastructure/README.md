# Lelu — Infrastructure

Deploy Lelu on the cloud provider that fits your stack. All paths produce the same architecture: Go engine + PostgreSQL + Redis behind a load balancer.

## Deployment options

| Path | Directory | Best for |
|---|---|---|
| **AWS ECS Fargate + Terraform** | [`aws/`](aws/) | AWS Generative AI Accelerator, production |
| **GCP Cloud Run** | [`gcp/`](gcp/) | GCP-native teams, serverless preference |
| **Kubernetes (any cloud)** | [`../helm/prism/`](../helm/prism/) | EKS, GKE, AKS, or self-hosted |

---

## Quickstart — AWS (recommended)

```bash
cd infrastructure/aws/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your region, db password, ACM cert ARN
terraform init && terraform apply
```

Full guide: [aws/README.md](aws/README.md)

---

## Quickstart — GCP Cloud Run

```bash
export GCP_PROJECT=your-project-id
export GCP_REGION=us-central1
bash infrastructure/gcp/setup.sh
```

Full guide: [gcp/README.md](gcp/README.md)

---

## Quickstart — Kubernetes (Helm)

```bash
helm install lelu ./helm/prism \
  --set engine.image=<your-registry>/lelu-engine:latest \
  --set global.engineApiKey=<your-api-key>
```

Works on EKS, GKE, AKS, or any CNCF-conformant cluster.

---

## Architecture (cloud-agnostic)

```
                    ┌──────────────────────────────────────┐
                    │           Load Balancer               │
                    └──────────────┬───────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
        lelu-engine           lelu-platform          lelu-ui
        (Go, :8080)           (Go, :9090)         (Next.js, :3000)
        /v1/authorize         /api/platform/*         /*
              │
     ┌────────┴────────┐
  PostgreSQL 15      Redis 7
  (audit logs,      (token store,
   policies)         review queue)
```

The **engine** is the only latency-critical service — it handles every `POST /v1/authorize` request inline. Keep it on dedicated compute (not scale-to-zero) for production authorization workloads.
