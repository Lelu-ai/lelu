---
title: Reject `javascript:` and plain-`http:` redirect URIs at OAuth client registration
labels: good first issue,bug,level-1-first-timer
---
`POST /oauth/clients` accepts `javascript:alert(1)`, `http://evil.example/cb` and wildcard redirect URIs, and `/oauth/authorize` then redirects a code to them.

**What to do** (in `engine/internal/mcpauth/server.go`)
- Allow only `https://` URIs, plus `http://localhost`, `http://127.0.0.1` and `http://[::1]` for local clients, plus custom app schemes that are not `javascript:`, `data:` or `file:`.
- Reject any URI containing `*` or a fragment.
- Add table-driven tests.

Audit reference: O2, O7b, O7c.
