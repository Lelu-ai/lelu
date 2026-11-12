# Lelu quickstart — see it work in 60 seconds

This runs the **real engine** on your machine — SQLite only, no Postgres, no Redis,
no cloud account — and fires one request for each of Lelu's four authorization
outcomes, including a live prompt-injection catch.

## Run it

```bash
git clone https://github.com/lelu-ai/lelu
cd lelu/examples/quickstart
./demo.sh
```

Requires Go 1.24+, `curl`, and `python3` — nothing else. The script builds the
engine, starts it, runs the requests, and cleans up after itself.

> Already have the engine built? Skip the build:
> `LELU_ENGINE_BIN=/path/to/lelu-engine ./demo.sh`

## What you'll see

Each call goes to `POST /v1/agent/authorize`. The engine returns boolean flags
(`allowed`, `requires_human_review`, `compute`) — your SDK turns those into one of
four decisions. This is **actual output** from the run:

**1. ALLOW** — a permitted low-risk action (`read_invoices`) with high confidence:
```json
{ "allowed": true, "requires_human_review": false, "reason": "action authorized" }
```

**2. DENY** — a prompt injection hidden in the request, caught before policy even runs:
```json
{
  "allowed": false,
  "requires_human_review": false,
  "reason": "prompt injection detected in resource: \"ignore all previous\""
}
```

**3. HUMAN_REVIEW** — the model wasn't confident enough, so it's held for a human:
```json
{
  "allowed": false,
  "requires_human_review": true,
  "reason": "confidence 80% requires human approval (threshold 90%)"
}
```

**4. COMPUTE** — a risky production deploy is redirected to a safe sandbox instead of blocked:
```json
{
  "allowed": true,
  "requires_human_review": false,
  "compute": true,
  "safe_tool": "deploy",
  "reason": "action \"deploy_app\" redirected to safe alternative \"deploy\" by compute rule"
}
```

> **Before you trust human review**
>
> Without `LELU_REVIEWER_KEYS`, any holder of the engine API key can approve a human review, including the agent that triggered it. The engine warns at boot, but review is not a security control until reviewer credentials are configured.
>
> - Set `LELU_REVIEWER_KEYS` to one or more `name:secret` pairs, comma-separated (each secret must be at least 16 characters), for example: `LELU_REVIEWER_KEYS="alice:change-me-to-a-long-random-secret"`.
> - Present the matching credential in the `X-Lelu-Reviewer-Key` header when approving or denying a queued review (alongside the normal API key).
> - Example: approve a pending review against `lelu-engine` running locally (replace `$REVIEW_ID`, API key, and reviewer secret with your values):
>
> ```bash
> # list pending reviews to find a REVIEW_ID
> curl -sS http://localhost:8082/v1/queue/pending \
>   -H "Authorization: Bearer $LELU_API_KEY"
>
> # approve with an authenticated reviewer key
> curl -sS -X POST "http://localhost:8082/v1/queue/$REVIEW_ID/approve" \
>   -H "Authorization: Bearer $LELU_API_KEY" \
>   -H "X-Lelu-Reviewer-Key: alice:$LELU_REVIEWER_SECRET" \
>   -H "Content-Type: application/json" \
>   -d '{"resolved_by":"alice","note":"Reviewed and approved."}'
> ```
>
> With reviewer keys configured, the engine records the authenticated reviewer identity from the credential (not a self-asserted `resolved_by`). See [Deployment security](../../docs/DEPLOYMENT_SECURITY.md) for more.

## The policy behind it

All four behaviours come from one small file, [`policy.yaml`](./policy.yaml):
- `invoice_bot` may `read_invoices`, `approve_refunds` and `deploy_app`, never `delete_invoices`.
- Confidence gating: `>= 0.90` allow · `0.70–0.89` review · `0.50–0.69` read-only · `< 0.50` deny.
- High-criticality actions such as `approve_refunds` are never auto-allowed, even
  at `>= 0.90`: the engine's risk model floors them at human review
  (`RISK_HIGH_CRITICALITY_FLOOR`, default `review`). That's why the ALLOW case
  is a read and `approve_refunds` at 0.95 would come back with
  `"requires_human_review": true`.
- A compute rule rewrites any `deploy_*` into a sandboxed staging deploy.

Edit `policy.yaml`, re-run `./demo.sh`, and watch the decisions change.

## Next

- Call it from your app with the [TypeScript](../../sdk/typescript) or
  [Python](../../sdk/python) SDK.
- Run the full stack (dashboard, Postgres, Redis) with `docker compose up` from
  the repo root. The engine is published on host port `8083`; the MCP service
  (port `3003`) needs `MCP_AUTH_TOKEN` set first — see the
  [MCP server README](../../sdk/mcp#http-transport-docker-compose).
