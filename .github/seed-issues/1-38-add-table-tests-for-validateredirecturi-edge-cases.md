---
title: Add table tests for `validateRedirectURI` edge cases
labels: good first issue,tests,level-1-first-timer
---
`engine/internal/mcpauth/server.go` now validates redirect URIs at client registration. The existing tests drive `POST /oauth/clients` for the main cases; the host-parsing edge cases deserve a fast unit test of `validateRedirectURI` and `isLoopbackHost` directly.

**What to do**
Add a table-driven test covering at least:
- `http://localhost@evil.example/cb` (must be refused: the host is `evil.example`)
- `http://localhost.evil.example/cb` and `http://127.0.0.1.evil.com/cb` (refused)
- `http://[::1]/cb` with and without a port (accepted)
- `HTTP://LOCALHOST/cb` (currently refused; document the behavior either way)
- `vbscript:x` and `blob:https://x` (currently accepted: decide whether to deny them and test the choice)

**Done when** `go test ./internal/mcpauth/` covers each of these cases.
