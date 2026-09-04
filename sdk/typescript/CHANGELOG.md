# Changelog

## [0.0.36] (2026-09-04)

**Requires engine ≥ 0.2.0** for the redemption endpoint. Against an earlier engine `waitAndRedeem()` will 404.

### Features

* **Redemption, finally.** `redeemReview()` and `waitAndRedeem()` bring this SDK to parity with the Python one. Until now a `human_review` decision could be *waited on* but never *redeemed* — and waiting alone only tells you a reviewer said yes to something; it does not bind that yes to what you then execute. These re-check your request against the one actually approved, so a payload altered in between is refused rather than riding a valid approval. `allowed` is false for timeout, denial and mismatch alike, so there is one thing to check rather than three.
* Both accept the `AuthDecision` from `authorize()` as well as a raw review id. Prefer the decision: it carries both `requestId` (trace) and `reviewId` (queue key), and reaching for "the request's id" gets the wrong one with no symptom until redemption fails. A decision with no `reviewId` now throws with an explanation instead of building a broken URL.
* **Strands Agents integration** (`lelu-agent-auth/strands`). `LeluIntervention`
  extends `InterventionHandler` — pass it to `new Agent({ interventions: [...] })`
  and every tool call is authorized before it runs. `allow` returns `Proceed`,
  `deny` returns `Deny` so the model is told why, `compute` returns `Transform`
  re-pointing the call at the safe tool, and `human_review` returns `Confirm`,
  pausing for a human through Strands' own interrupt system. Set
  `onReview: "deny"` if approval lives in Lelu's review queue instead, and resume
  with `guard.redeem()`.
* `onError` defaults to `"deny"` rather than Strands' `"throw"`: a broken
  authorization check should block a tool call, not surface as an unhandled error.
* `@strands-agents/sdk` is an **optional peer dependency**, so it costs nothing to
  anyone not using Strands.

### Compatibility

* **`zod` widened to `^3.23.0 || ^4.0.0`.** Strands requires zod 4, and this
  package pinned 3. The only blocker was three single-argument `z.record()` calls,
  which v4 removed; the two-argument form is valid in both, so the change carries
  no compatibility cost. The test suite runs on zod 4.5.4.

### Internal

* `authorize()` and `redeemReview()` now share one request-body builder. The engine fingerprints the effect-determining fields of that body to bind an approval to a payload; two call sites building it even slightly differently would make an unmodified request fail redemption with no visible cause. This mirrors the Python client, deliberately.

## [0.0.35] (2026-08-01)

### Security Fixes

* **Enforcement inversion on scope downgrade / compute redirect.** The primary `authorize()` method never surfaced `downgradedScope`/`effectiveScope` from the engine response at all, and the legacy `agentAuthorize()` explicitly discarded `downgradedScope`. As a result, every wrapper — `SecureTool`, `secureNode`, the Vercel AI SDK `secureTool`, and the Express `authorize()` middleware — branched only on `allowed`, which the engine also sets to `true` for a `read_only` downgrade or a `compute` redirect. All four ran the wrapped tool/node/route at full, unrestricted scope instead of respecting the restriction. `authorize()`/`agentAuthorize()` now correctly surface `downgradedScope`/`effectiveScope`/`computed`, and all four wrappers refuse to execute unless the decision is a clean allow.
* **Unaddressable human-review decisions.** `AuthDecision`/`AgentAuthDecision` now carry `reviewId` (from the engine's new `review_id` field), and `SecureTool`/`secureNode` surface it, so a `human_review` decision can actually be resolved via `getQueueItem()`/`waitForApproval()`/`approveQueueItem()`/`denyQueueItem()` instead of returning an unaddressable string.
* `ConfidenceSignalSchema` no longer accepts `provider: "anthropic"` — Anthropic exposes no token-level log-prob data on any model, so a signal claiming that provenance could never be genuine. This is client-side defense in depth; the fix that actually matters is server-side (see the engine changelog).

Requires engine ≥ 0.1.1 for the confidence-verification and review-ID fixes to take effect. We recommend upgrading promptly if you use `SecureTool`, `secureNode`, the Vercel integration, or the Express middleware against a policy with `read_only` downgrades or `compute` redirects.

## [0.0.34] (2026-07-31)

### Features — parity with the Python SDK

* **Engine policy management** — `getEnginePolicy()` (`GET /v1/policy`), `validatePolicy(yaml)` (`POST /v1/policy/validate`), and `putEnginePolicy(yaml, ifMatch?)` (`PUT /v1/policy`, admin key + optimistic concurrency via `If-Match`). New `EnginePolicyInfo` / `PolicyValidationResult` / `PolicyUpdateResult` types. These target the engine's live policy — distinct from `listPolicies`/`getPolicy`/`upsertPolicy`/`deletePolicy`, which manage the platform's stored policies via `/api/policies`.
* **LangGraph.js integration** (`lelu-agent-auth/langgraph`) — `secureNode()` gates any LangGraph.js node through Lelu's Confidence-Aware Auth before it runs, returning augmented state (`leluDenied`/`leluPendingReview`/`leluReason`) or throwing `LeluDeniedError`. Mirrors the Python SDK's `lelu.langgraph.secure_node`. Framework-agnostic — no dependency on `@langchain/langgraph`.

### Bug Fixes

* **`SimulatorDecision.outcome` corrected to `"allow" | "review" | "deny"`.** It was typed as `"allow" | "human_review" | "deny"`, but the engine's `POST /v1/simulator/replay` has always emitted `"review"` for the human-review outcome (confirmed against `engine/internal/server/server.go`'s `simulatorOutcome()` and the platform's own simulator UI) — `"human_review"` never actually appears on the wire. Found via a live smoke test against a running engine while adding root-level exports for these types.

### Documentation

* `SimulatorReplayRequest` / `SimulatorReplayResponse` are now exported from the package root (previously only reachable via a deep import despite `simulatorReplay()` requiring them).

## [0.0.33] (2026-07-14)

### Miscellaneous

* **Republished with a corrected README.** No functional SDK changes — 0.0.32 shipped with a stale README, 0.0.33 corrects it.

## [0.0.32] (2026-07-14)

### Bug Fixes

* **`LocalStorage` no longer crashes a plain import.** It eagerly imported `better-sqlite3` (an optional peer dependency with native bindings) from the package's main entry point, so `import { lelu } from "lelu-agent-auth"` threw `MODULE_NOT_FOUND` for anyone who hadn't separately installed it — which is everyone on the zero-config path. `better-sqlite3` is now loaded lazily inside the `LocalStorage` constructor; only callers who actually construct it need the dependency.

## [0.0.31] (2026-07-13)

### Features

* **`lelu(options)` shared-instance factory** — `.api` exposes the full `LeluClient`, `.authorize()` fills in a default `actor` when the request omits one, and `.handler` is a fetch-style (`Request → Response`) handler you can mount in any Web-standard framework route (Next.js, Hono, Bun, Deno) to expose `authorize`/`queue`/`approve`/`deny`/`ok` without the browser ever seeing the engine URL or API key.
* **`discoverLocalEngine()`** — connects automatically to the engine `npx lelu-mcp start` runs locally, reading `~/.lelu/engine.json` + `~/.lelu/engine.key` with a PID-liveness check before trusting them.
* **Express adapter accepts a `lelu()` instance** — new `toNodeHandler(auth)` bridges the fetch-style handler onto Express's `(req, res)` signature.

## [0.0.30] (2026-07-03)

### Features

* **Verified confidence signals.** `authorize()` can now send a verified `confidence_signal` (`provider` + `tokenLogProbs`/`tokenProbabilities`/`entropy`) instead of a bare self-reported `confidence` — previously the `confidenceFrom` extractors existed but the client had no way to send the underlying signal, so production engines (which treat unverified `confidence` as untrusted) denied every call. New `LeluClient.signalFrom.{openai,anthropic,bedrock,local}` builders return a `ConfidenceSignal` for `context.signal`; `confidence` remains dev-mode-only (honored when the engine runs with `CONFIDENCE_ALLOW_UNVERIFIED=true`).

### Bug Fixes

* **Honest default `baseUrl`.** The default is now always `http://localhost:8080` — passing an `apiKey` alone no longer silently targets `https://lelu-ai.com`, which serves no `/v1/*` engine endpoints and 404ed on every call. `CLOUD_URL` docs corrected to clarify it only serves the platform's `/api/v1/*` audit API.
* **Missing `@opentelemetry/api` dependency declared** — it's imported by the exported `AgentTracer` but was absent from `package.json`, breaking fresh installs since 0.0.29.

### Platform

* `/api/policies` and `/api/policies/[id]` now accept `Authorization: Bearer lelu_sk_...` API keys (in addition to the session cookie), so SDK policy management actually works — previously every SDK call 401ed.

## [0.0.29] (2026-06-16)

### Bug Fixes

* **`actor` now reaches the engine.** `authorize()` and `agentAuthorize()` never sent the `actor` field, so the engine always saw an empty actor and denied every request with `unknown agent scope ""` — meaning **no `agent_scopes` policy could be matched through the SDK**. `AuthorizeRequest` now carries an optional `actor`, and `agentAuthorize()` forwards it.

### Features

* **`LeluClient.confidenceFrom.bedrock()`** — derive a verified confidence score from an Amazon Bedrock response (Cohere `token_likelihoods`, or a passed-through logprobs array). Returns `null` for models without token log-probs (e.g. Claude on Bedrock) so you omit the signal and let the engine's `MissingSignalMode` decide.

## [0.0.20] (2026-06-03)

### Features

* **OAuth Token Vault** — full vault support: `vaultStore()`, `vaultGetToken()`, `vaultRevoke()`, `vaultList()`, `vaultProviders()`
* New types: `VaultStoreRequest`, `VaultStoreResult`, `VaultTokenResult`, `VaultCredentialSummary` — all exported from package root
* `VaultTokenResult.refreshed` — indicates whether the access token was transparently refreshed before returning
* `VaultCredentialSummary.expired` — boolean flag when the stored token is past its expiry

### Bug Fixes

* `VaultCredentialSummary.expiresAt` typed as `string | undefined` (not optional `?`) for strict TS compatibility
* Engine upsert now returns correct existing `id` after conflict update

## [0.0.19] (2026-06-01)

### Features

* `AuthDecision` extended with forensic fields: `inputHash`, `outputHash`, `policyDigest` — surfaced from engine response for tamper-proof client-side verification
* `AuditEvent.decision` union now includes `"compute"` — aligns with engine's four-decision model
* `AuditEvent` extended with `inputHash`, `outputHash`, `policyDigest` optional fields
* `authorize()` in `LeluClient` extracts and returns all three new fields when present in the engine response

## [0.0.18] (2026-05-30)

### Engine Upgrades

* **injection detector**: 5-layer pipeline (exact → homoglyph → fuzzy → structural → entropy), 45 patterns, unicode normalization, Levenshtein fuzzy match — detection rate raised from ~60% to ~85%+
* **anomaly detector**: replaced z-score baseline with real Extended Isolation Forest in pure Go — random hyperplane splits, multivariate interaction scoring, automatic fallback until forest is trained
* **policy evaluator**: wildcard pattern matching — `*`, `read_*`, `*_prod`, `*_prod_*` all supported; deny-first evaluation with matched pattern reported in audit reason
* **confidence escalator**: isotonic regression calibration via Pool Adjacent Violators (PAV) algorithm; dynamic threshold maximises TPR at FPR ≤ 5%; smooth ≤0.1 threshold shifts per refit cycle

### Bug Fixes

* `compute` decision now correctly included in AuditEvent decision union on the platform
* Audit log and policy editor aligned on all four decisions: `allow`, `deny`, `human_review`, `compute`

## [0.2.7](https://github.com/lelu-ai/lelu/compare/typescript-sdk-v0.2.6...typescript-sdk-v0.2.7) (2026-03-30)


### Features

* add 'lelu studio' command for visual UI management ([481e761](https://github.com/lelu-ai/lelu/commit/481e76171969c5dd41de80ce8d722cf831725127))
* Add anonymous rate limiting, dashboard, and API key management ([b8f24ad](https://github.com/lelu-ai/lelu/commit/b8f24ad55b5f72b3daee88bb18341635036b7fc3))
* Add built-in CLI audit-log command to all SDKs ([0943686](https://github.com/lelu-ai/lelu/commit/094368663337c0f6844b8b159aabfe53ebe79ccf))
* Add comprehensive CLI functionality to all SDKs ([61f292b](https://github.com/lelu-ai/lelu/commit/61f292bd35eb806d3812bb8e593ddebb3dac8db4))
* add HITL UI, Semantic Policy Generator, and Agent Reputation Dashboard ([a5586d4](https://github.com/lelu-ai/lelu/commit/a5586d4c8b709fc611404086d22045c4b7f9d9e7))
* Add SQLite local storage for all SDKs ([e38a67a](https://github.com/lelu-ai/lelu/commit/e38a67afd4e32c8b3b2966e378e918773f404ee3))
* Complete Phase 2 Behavioral Analytics SDK Updates ([0692d0d](https://github.com/lelu-ai/lelu/commit/0692d0dd221fc29c23abdb25f71019e8676f86aa))
* enhance React UI components with better styling and features ([84d7be0](https://github.com/lelu-ai/lelu/commit/84d7be0fd453ab2e2a2e8c6e805e07a7a1ccd6c0))
* implement multi-tenancy and fix SDK compilation ([bdd1e14](https://github.com/lelu-ai/lelu/commit/bdd1e140f5cff660a0cb22a3472307453669822f))
* implement Phase 1 Enhanced Observability & Telemetry for AI Agents ([c3a80f7](https://github.com/lelu-ai/lelu/commit/c3a80f707052e1958021a89333fc54f416bb079a))
* implement Phase 2 behavioral analytics across all SDKs ([c07a71f](https://github.com/lelu-ai/lelu/commit/c07a71f3966b608c6e640f1082b596baec69cb84))
* implement Prisma-like simple flow for lelu studio ([98b1945](https://github.com/lelu-ai/lelu/commit/98b1945b793eb893fd146c5d09b0e5447f07e377))
* implement production readiness features (API Key, Prometheus Metrics, Redis Queue) ([3cd2be0](https://github.com/lelu-ai/lelu/commit/3cd2be03d459c3c1abbfb5417c918e54b4f48096))
* Phase 1 — Go engine, Docker, CI/CD, TS + Python SDKs ([575a5d7](https://github.com/lelu-ai/lelu/commit/575a5d799a712b7dda8f5d2f42a5ec1c4e11489f))
* Phase 2 — Confidence Layer (queue, SecureTool, LangGraph, S3 sink) ([bb271e4](https://github.com/lelu-ai/lelu/commit/bb271e40ab3fc59dab18d5f4f755dc1045c5d8a0))
* Phase 3 — Cloud Platform, Trace Explorer UI, React hook, FastAPI/Express middleware ([b3ea833](https://github.com/lelu-ai/lelu/commit/b3ea83306d2744f7fdeed00d70d7c75966ff6160))
* release TypeScript SDK v0.2.7 with hosted engine integration ([2c84a4b](https://github.com/lelu-ai/lelu/commit/2c84a4b16ebbdc4c0f7f03ee50cd438ca1a1fd4d))
* rename to prizm-engine and overhaul UI landing page ([2b1c0ad](https://github.com/lelu-ai/lelu/commit/2b1c0ad6ed65c1c9be979c2122c297ba8d3db6b2))
* **ts-sdk:** add dashboard bootstrap CLI command ([7f93e69](https://github.com/lelu-ai/lelu/commit/7f93e69d75266975c18399e7d861f0cf8138568a))


### Bug Fixes

* add package-lock.json for npm ci cache in CI ([7228444](https://github.com/lelu-ai/lelu/commit/7228444a5c5e8513ab159e4495d462ccd100e749))
* Bump TypeScript SDK to v0.1.10 and deprecate v0.1.9 ([b0161a5](https://github.com/lelu-ai/lelu/commit/b0161a5fd90735db47379f18f279f7e700b54e94))
* exactOptionalPropertyTypes errors in TS SDK (apiKey, downgradedScope) ([c9639fe](https://github.com/lelu-ai/lelu/commit/c9639fec25059166eb505377500b392f474ae290))
* remove duplicate LeluClient identifiers in TypeScript SDK ([6583a7d](https://github.com/lelu-ai/lelu/commit/6583a7d8943fd2ad1f989350ec24e7b2640d3ed4))
* reorder exports so types comes first in TS SDK ([ef43488](https://github.com/lelu-ai/lelu/commit/ef43488f6740d7b8fd86d7401839d2239eb097c9))
* resolve TypeScript type checking errors in observability ([6206a58](https://github.com/lelu-ai/lelu/commit/6206a5890e17141bd8e9f360893f477cc199e26f))


### Documentation

* Add Docker deployment documentation and update SDK packages ([15d4d15](https://github.com/lelu-ai/lelu/commit/15d4d15db185b2c4a1a97eb5ea6f330a1f40343c))
* add Docker Hub engine usage across READMEs ([f96f7dc](https://github.com/lelu-ai/lelu/commit/f96f7dc93139e720ad00fbbc2d18889eb0cd7473))
* add POSTMAN.md testing guide + fix SecureTool test imports ([14b050c](https://github.com/lelu-ai/lelu/commit/14b050c1150a2fc5e431b5d140bbafe8b32d9ded))
* migrate repository references to lelu-ai ([8b30620](https://github.com/lelu-ai/lelu/commit/8b30620c40828d30a613436530ddcf5db790f6b9))
* **sdk:** add logo and bump @lelu-ai/lelu to 0.1.2 ([5c78d30](https://github.com/lelu-ai/lelu/commit/5c78d3015180b77a75651729dc8310d04f62c8cf))
* update license copyright email ([80dffb6](https://github.com/lelu-ai/lelu/commit/80dffb60105b644caf2d8da9d0a4cd6e7ff61704))


### Miscellaneous

* **branding:** finalize Prism naming across repo ([d33b53c](https://github.com/lelu-ai/lelu/commit/d33b53ca1a5f2d9da5d82b3113f4e927f3168d1f))
* bump TypeScript SDK to v0.1.5 and publish with audit-log CLI ([8d037fa](https://github.com/lelu-ai/lelu/commit/8d037fabad7ae4f1b5e5bf4d90960642292db65c))
* bump version to 0.0.5 and add author information ([0ffd3d8](https://github.com/lelu-ai/lelu/commit/0ffd3d8aaa22bb4fa035f760aa9fb52a2a333f8c))
* release main ([f1dfe74](https://github.com/lelu-ai/lelu/commit/f1dfe74e67498f3e1a05d8a56cfc02cc55c073db))
* release main ([9fb4e99](https://github.com/lelu-ai/lelu/commit/9fb4e992820e42a821988f2c7735d339cadfde48))
* **sdk:** rename npm package references to prism ([5313e3c](https://github.com/lelu-ai/lelu/commit/5313e3c6bca43713848b1ac455f1da16fc19491a))
* **sdk:** update npm logo/docs links and bump to 0.1.3 ([c6d56fc](https://github.com/lelu-ai/lelu/commit/c6d56fca02ed0a62110dccac169c4ae2b7ffe3c6))
* update homepage to Vercel docs site and add gitignore for UI ([d4c51ea](https://github.com/lelu-ai/lelu/commit/d4c51ea931a159bc6b7e49abd17ecdf6475af01e))
* Update package-lock.json for TypeScript SDK ([a24f1eb](https://github.com/lelu-ai/lelu/commit/a24f1eb96fd8f5d6c62ef07bb93b7a61312a9932))
* Update SDK exports and engine dependencies ([9a03031](https://github.com/lelu-ai/lelu/commit/9a030315168a6d74fa4c1a0496cf45990987462a))

## [0.1.1](https://github.com/lelu-ai/lelu/compare/typescript-sdk-v0.1.0...typescript-sdk-v0.1.1) (2026-03-08)


### Features

* add HITL UI, Semantic Policy Generator, and Agent Reputation Dashboard ([a5586d4](https://github.com/lelu-ai/lelu/commit/a5586d4c8b709fc611404086d22045c4b7f9d9e7))
* enhance React UI components with better styling and features ([84d7be0](https://github.com/lelu-ai/lelu/commit/84d7be0fd453ab2e2a2e8c6e805e07a7a1ccd6c0))
* implement multi-tenancy and fix SDK compilation ([bdd1e14](https://github.com/lelu-ai/lelu/commit/bdd1e140f5cff660a0cb22a3472307453669822f))
* implement production readiness features (API Key, Prometheus Metrics, Redis Queue) ([3cd2be0](https://github.com/lelu-ai/lelu/commit/3cd2be03d459c3c1abbfb5417c918e54b4f48096))
* Phase 1 — Go engine, Docker, CI/CD, TS + Python SDKs ([575a5d7](https://github.com/lelu-ai/lelu/commit/575a5d799a712b7dda8f5d2f42a5ec1c4e11489f))
* Phase 2 — Confidence Layer (queue, SecureTool, LangGraph, S3 sink) ([bb271e4](https://github.com/lelu-ai/lelu/commit/bb271e40ab3fc59dab18d5f4f755dc1045c5d8a0))
* Phase 3 — Cloud Platform, Trace Explorer UI, React hook, FastAPI/Express middleware ([b3ea833](https://github.com/lelu-ai/lelu/commit/b3ea83306d2744f7fdeed00d70d7c75966ff6160))
* rename to prizm-engine and overhaul UI landing page ([2b1c0ad](https://github.com/lelu-ai/lelu/commit/2b1c0ad6ed65c1c9be979c2122c297ba8d3db6b2))


### Bug Fixes

* add package-lock.json for npm ci cache in CI ([7228444](https://github.com/lelu-ai/lelu/commit/7228444a5c5e8513ab159e4495d462ccd100e749))
* exactOptionalPropertyTypes errors in TS SDK (apiKey, downgradedScope) ([c9639fe](https://github.com/lelu-ai/lelu/commit/c9639fec25059166eb505377500b392f474ae290))
* remove duplicate LeluClient identifiers in TypeScript SDK ([6583a7d](https://github.com/lelu-ai/lelu/commit/6583a7d8943fd2ad1f989350ec24e7b2640d3ed4))
* reorder exports so types comes first in TS SDK ([ef43488](https://github.com/lelu-ai/lelu/commit/ef43488f6740d7b8fd86d7401839d2239eb097c9))


### Documentation

* add POSTMAN.md testing guide + fix SecureTool test imports ([14b050c](https://github.com/lelu-ai/lelu/commit/14b050c1150a2fc5e431b5d140bbafe8b32d9ded))
* migrate repository references to lelu-ai ([8b30620](https://github.com/lelu-ai/lelu/commit/8b30620c40828d30a613436530ddcf5db790f6b9))
* update license copyright email ([80dffb6](https://github.com/lelu-ai/lelu/commit/80dffb60105b644caf2d8da9d0a4cd6e7ff61704))


### Miscellaneous

* **branding:** finalize Prism naming across repo ([d33b53c](https://github.com/lelu-ai/lelu/commit/d33b53ca1a5f2d9da5d82b3113f4e927f3168d1f))
* **sdk:** rename npm package references to prism ([5313e3c](https://github.com/lelu-ai/lelu/commit/5313e3c6bca43713848b1ac455f1da16fc19491a))
