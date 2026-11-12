---
title: Document why `LELU_REVIEWER_KEYS` matters in every quickstart
labels: good first issue,documentation,level-1-first-timer
---
Without `LELU_REVIEWER_KEYS`, any holder of the API key can approve a human review, including the agent that triggered it. The engine warns at boot, but none of the quickstarts mention it.

**What to do**
- Add a short "Before you trust human review" box to `examples/quickstart/README.md` and `sdk/mcp/README.md` explaining the variable, the `name:secret` format (secret at least 16 characters) and the `X-Lelu-Reviewer-Key` header.
- Show one working `curl` that approves a review with a reviewer key.

**Done when** both READMEs explain the risk and the fix, and the example command works against `lelu-engine` locally.

Audit reference: HITL-01 (human review is self-service by default).
