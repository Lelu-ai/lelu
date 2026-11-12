---
title: Make `/healthz` return liveness only to anonymous callers
labels: good first issue,bug,level-1-first-timer
---
`GET /healthz` is unauthenticated and returns the version, auth mode, whether reviewer credentials are configured, rate-limit status and more. That is useful to an attacker choosing a target.

**What to do**
- Anonymous callers get `{"status":"ok"}` (and 503 when unhealthy).
- Callers with a valid credential get the current detailed body.
- Keep the Docker/Helm health checks working (they only need the status code).

**Done when** a test shows the anonymous body has no `dependencies` or `version` keys and the authenticated body still does.

Audit reference: AUTH-05. File: `engine/internal/server/server.go` (`handleHealth`).
