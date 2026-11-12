---
title: Python SDK: send `confidence_signal`
labels: help wanted,enhancement,level-2-intermediate
---
`AgentContext` has no `confidence_signal` field, so against an engine in its default (strict) mode every non-denied action is denied.

**What to do** add the field and the helpers that build it (`openai`, `bedrock`, `local`), mirroring the TypeScript SDK. Add a test against a mocked engine that rejects requests without a signal.

Audit reference: S7.
