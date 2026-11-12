---
title: URL-encode `state` when building the OAuth redirect
labels: good first issue,bug,level-1-first-timer
---
A `state` value such as `x&code=attackercode&foo=` is appended unescaped, so it injects extra parameters into the redirect URL.

**What to do** (in `engine/internal/mcpauth/server.go`) build the redirect with `url.Values` and `Encode()`. Add a test with `&`, `#`, `=` and a space in `state`.

Audit reference: O9.
