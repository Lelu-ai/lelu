---
title: Document the anonymous and authenticated responses of `GET /healthz`
labels: good first issue,documentation,level-1-first-timer
---
The API docs table in `platform/ui/app/docs/concepts/api/page.tsx` describes `/healthz` as "Engine health check." Once #82 lands, anonymous callers get only `{"status":"ok"}` (or `"degraded"`), and callers presenting a valid credential also get the engine version and dependency details.

**What to do**
- Update the `/healthz` row (both places it appears in that page) to describe the two responses and say the status code is the same for both.
- Add a short `curl` example of each.

**Done when** the docs match the behavior in `engine/internal/server/server.go` (`handleHealth`). Blocked until #82 is merged.
