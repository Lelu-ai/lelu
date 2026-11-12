---
title: TypeScript SDK: `redeemReview` should return the refusal, not throw
labels: good first issue,bug,level-1-first-timer
---
The docstring says `redeemReview` "returns RedeemResult rather than throwing on refusal". Against a real engine a refused redemption is HTTP 403 and the SDK throws `AuthEngineError`, losing the reason. The Python SDK returns the result correctly.

**What to do** in `sdk/typescript/src/client.ts` treat 403 with a `{allowed:false, reason}` body as a result. Add a test with a mocked 403.

Audit reference: S6.
