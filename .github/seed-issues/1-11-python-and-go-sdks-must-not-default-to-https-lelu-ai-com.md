---
title: Python and Go SDKs must not default to `https://lelu-ai.com`
labels: good first issue,bug,level-1-first-timer
---
With only an API key set, the Python (`auth_pe/client.py`) and Go (`sdk/go/client.go`) clients send actions and context to the hosted service. The TypeScript SDK correctly uses a local engine unless told otherwise.

**What to do** match the TypeScript behaviour: require an explicit `base_url` (or discover the local engine), and raise a clear error otherwise. Add a test that no network call is made to the hosted host.

Audit reference: S9, V5.
