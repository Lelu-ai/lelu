# Deployment security settings

Several of Lelu's controls are only controls if they are configured. This page
lists the settings that decide whether a given guarantee actually holds, what
happens when each is left unset, and how to check the running system rather
than the config.

It exists because a recurring failure mode in this codebase was a control that
was off by default and said nothing about it — the operator had no way to tell
a protected deployment from an unprotected one.

## Check the running system first

```bash
curl -s -H "Authorization: Bearer $API_KEY" http://127.0.0.1:8083/healthz | jq
```

`/healthz` reports what is actually running: whether reviewer credentials are
configured, whether rate limiting is on, whether the identity registry and MCP
OAuth server came up, whether the deployment is single-static-admin, and
whether the audit pipeline has lost anything. A deployment reporting
`"status": "degraded"` with a non-zero `audit.events_dropped` is answering
authorization requests while losing the record of them.

The startup log states the authentication mode and the review-credential mode
explicitly, in both the configured and unconfigured cases.

## Settings

| Variable | Default | What it decides |
|---|---|---|
| `LELU_REVIEWER_KEYS` | unset | `name:secret` pairs, comma-separated. Presented in the `X-Lelu-Reviewer-Key` header. **Unset, human review is not a security control** — reviewer identity falls back to a `resolved_by` string the caller supplies, and an agent holding an API key can resolve the reviews it triggered under any name but its own. |
| `TENANT_AUTH_RATE_LIMIT` | `6000`/min | Per-tenant authorize ceiling. At `0` the limiter is never constructed and a single credential can saturate the audit writer. |
| `TENANT_MINT_RATE_LIMIT` | `600`/min | Per-tenant token-mint ceiling. Same. |
| `LELU_AUDIT_STATE_PATH` | `<db dir>/audit-chain.json` | Receipt-chain continuity across restarts. Unset, every process start opens a fresh genesis and deleting one process lifetime of events leaves a log that still verifies. |
| `LELU_AUDIT_BLOCK_ON_FULL` | `false` | `true` applies backpressure instead of dropping audit events, so a decision cannot be returned to a caller without its record being queued. Costs hot-path latency. Turn it on where the log is evidence rather than telemetry. |
| `LELU_ADVERTISE_AUTH_SERVER` | `false` | Publishes `/.well-known/oauth-authorization-server` and `openid-configuration`. Only turn this on if you intend third-party MCP resource servers to trust tokens this engine signs. There is no resource-owner consent step; scope is bounded by the client's registration, not by a human's decision. `/.well-known/jwks.json` is always published — audit receipts are unverifiable without it. |
| `LELU_ISSUER` | `LELU_ENGINE_PUBLIC_URL` | Published verbatim in the discovery documents as the authorization, registration and JWKS endpoints. Set it to a URL your clients can actually reach. |
| `LELU_METRICS_PUBLIC` | `false` | `/metrics` names agents, actions and volumes. Authenticated unless this is `true`. |
| `MCP_AUTH_TOKEN` | required for HTTP | The MCP server holds the engine's API key and mints agent tokens on its callers' behalf. The HTTP/SSE transport refuses to start without this. Not used by the stdio transport, where the peer is the process that spawned it. |
| `MCP_BIND_ADDR` | `127.0.0.1` | Bind address for the MCP HTTP transport. |
| `LELU_DEV_INSECURE` | unset | Local development only. Runs with no authentication at all. |

## Things a stock deployment needs to get right

**A writable `/var/lib/lelu`.** Without it the engine cannot persist its RSA
signing key, so every restart signs audit receipts with a fresh key; it cannot
open its database, so the identity registry, JWKS endpoint, vault and analytics
never start; and it cannot persist the chain state. The shipped image creates
the directory and the compose file mounts a volume. If you write your own,
carry both across.

**A cgo-enabled build.** `CGO_ENABLED=0` compiles `go-sqlite3` to a stub. The
database is what the identity registry needs, and the identity registry is what
serves the public half of the receipt signing key — so a no-cgo build produces
receipts nobody can ever verify and reports that only as a warning at boot.

**Redis actually reachable.** The engine falls back to an in-memory review
queue when Redis is unreachable, not only when `REDIS_ADDR` fails to parse.
Both cases now log the warning; check for it.

**Policy directory mounted read-only** is a safe default, and `PUT /v1/policy`
reports `501` rather than failing at write time. Mount it writable only if you
intend that endpoint to work.
