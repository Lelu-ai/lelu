---
title: Go SDK: discover a local engine like the Python and TypeScript SDKs
labels: help wanted,enhancement,level-2-intermediate
---
The TypeScript and Python SDKs find the engine that `lelu-mcp` is running (recorded under `~/.lelu`) when no `BaseURL` is given, and use its API key. The Go SDK has no such discovery: with no `BaseURL` it uses `http://localhost:8080`.

**What to do**
- Port `discoverLocalEngine` (see `sdk/typescript/src/local.ts` and `sdk/python/auth_pe/local.py`) to Go, keeping the explicit-`BaseURL`-wins rule and never defaulting to the cloud.
- Keep a caller's explicit `APIKey`; only fill it from the discovered engine when empty.
- Add tests with a temporary `LELU_HOME`.

**Done when** `NewClient(ClientConfig{})` connects to a running local engine without configuration, and the existing tests still pass.
