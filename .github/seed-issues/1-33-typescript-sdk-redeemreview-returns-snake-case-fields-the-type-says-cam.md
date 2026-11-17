---
title: TypeScript SDK: `redeemReview` returns `review_id`/`trace_id`, but `RedeemResult` declares `reviewId`/`traceId`
labels: good first issue,bug,level-1-first-timer
---
`redeemReview()` returns the engine's JSON as is. The engine sends `review_id` and `trace_id`; the `RedeemResult` type in `sdk/typescript/src/types.ts` declares `reviewId?` and `traceId?`. So `result.reviewId` is `undefined` at runtime even though the type says it may be set.

**What to do**
- Map the response in `redeemReview` (and on the refusal path, which returns a 403 body) to the `RedeemResult` shape.
- Extend the existing `redeemReview()` tests in `client.test.ts` to assert `reviewId` and `traceId`.

**Done when** a test sending `review_id` / `trace_id` from a mocked engine sees `reviewId` / `traceId` on the result.
