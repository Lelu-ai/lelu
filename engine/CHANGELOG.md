# Changelog

## [0.2.0] (2026-09-03)

_Continues from the `engine-v0.1.0` tag (2026-07-04). The entries below (0.1.6 and earlier) predate the Lelu rename and the versioning restart that came with it — kept for history, but not a continuous sequence with this one._

_A `0.1.1` was drafted but never tagged; everything it covered is included here. If you were waiting on `engine-v0.1.1` for `review_id`, this is that release._

Minor bump rather than a patch because this carries breaking changes — see below. Pre-1.0, so breaking changes ride a minor bump.

### Breaking

* **`confidence_verified` is now `provider_signal_present` in the authorize response and audit events.** The old name claimed more than the check establishes: it was true whenever a well-formed `confidence_signal` was submitted for a provider that *can* expose log-probs, not when Lelu confirmed the numbers came from a real API response — which it never does. `token_logprobs: [0,0,0]` was reported as "verified". Renamed rather than repaired: actually verifying a provider signal means a trusted adapter per provider, which is separate work. Update any caller reading `confidence_verified`.
* **`/oauth/clients` and `/oauth/authorize` now require a credential.** They were exempted from auth entirely, so anyone with network access could register an OAuth client, get an authorization code with no resource-owner consent, and exchange it for an RS256 JWT signed by the engine's identity key with arbitrary scope. Lelu never accepted those tokens itself, but any MCP resource server trusting Lelu as an issuer via `/.well-known/jwks.json` would. `/oauth/token` remains unauthenticated — it's protected by the client's own PKCE verifier, secret, or refresh token.
* **`PUT /v1/policy` now enforces the admin credential in every auth mode.** The check only ran when a static `API_KEY` was configured, so in `PLATFORM_URL` mode it silently did nothing and any account-bound key could overwrite the global policy for every tenant.

### Security Fixes

* **Authentication resolved an identity and then discarded it.** In `PLATFORM_URL` mode the key verifier resolved a `userID` and the middleware threw it away, after which every handler read `tenant_id`/`actor` from the request body. With any valid `lelu_sk_` key that meant: reading decrypted vault tokens for any agent/user/provider triple, listing and suspending/revoking agents across tenants, rate limits keyed on a caller-chosen string, and audit records attributing to whatever was claimed. A `Principal` is now bound to the request context after authentication, and the vault, agent-registry, rate-limit and audit paths all derive identity from it.
* **An agent could approve its own `human_review` item.** `POST /v1/queue/{id}/approve` accepted the same API key the flagged agent already held, with `resolved_by` as free text. Resolving an item under the same actor name it was raised against is now refused. This closes the named case; a fully separate reviewer credential is still the right long-term answer.
* **Unused `internal/apikeys` and `internal/middleware` deleted.** Unimported but compiled and tested, and carrying real bugs: raw-secret Redis storage, `Sprintf`/substring metadata parsing that let a crafted name inject fields, a `BindIPToKey` path that resurrected revoked keys on IP change, and `X-Forwarded-For` trusted from any source.

* **Anthropic confidence signals could bypass verification.** `resolveConfidence` marked any `confidence_signal` as verified solely because the field was present, with no provider-capability check, and `ExtractScore` routed `provider: "anthropic"` through the same log-prob path as OpenAI — even though Anthropic exposes no token-level log-prob data on any model. A caller could attach a fabricated log-prob array tagged `"provider": "anthropic"` and have it accepted as a verified signal, bypassing `MissingSignalMode` entirely. Anthropic now always returns an explanatory error, the same pattern already used for Claude on Bedrock, so the signal is correctly treated as missing rather than trusted.
* **Confidence calibrator could return a fully inverted score outside its fitted range.** The isotonic calibrator only ever trains on the review-queue band — scores that auto-allow or auto-deny never reach it — and previously clamped out-of-range inputs to the *terminal fitted value* instead of returning them unchanged. In an ordinary early-deployment state (the first several human reviews all approved), this could calibrate a raw confidence of 0.0 to roughly 1.0 — a full confidence-gate bypass. The calibrator now refuses to fit on a single-class buffer and returns the raw score unchanged for inputs outside its fitted support.
* **`human_review` decisions didn't carry a review ID.** The queue item ID returned by `Enqueue` was discarded, so the response had no way to reference the pending review — `GET /v1/queue/{id}`, the long-poll `/wait` endpoint, and approve/deny could never be used to resolve it programmatically. The response now includes `review_id` whenever a decision requires human review.

### Features

* **Approvals are bound to a payload, and revalidated before execution.** Previously an approval bound to a review ID and nothing else — an agent could get one payload approved and execute a different one under the same ID, with the approval and the ID both still valid. Enqueue now fingerprints the effect-determining fields (action, resource, args, acting_for, scope), and a new `POST /v1/queue/{id}/redeem` re-checks that fingerprint against the payload the caller is about to run. Approvals also expire (15 minutes) so they can't be banked and spent against circumstances the reviewer never saw. Confidence is deliberately outside the fingerprint: a reviewer approves an effect, not the model's confidence in it. Requires Python SDK ≥ 0.5.0 to use from the client (`wait_and_redeem`).
* **Agent identity can now be cryptographically verified.** The identity registry (agent registration, RS256 workload tokens, JWKS) already existed but was never wired into authorization — `actor` was a free-text claim. `/v1/agent/authorize` now accepts an optional `X-Lelu-Agent-Token`; when present and valid it replaces the self-reported actor, and the response and audit event carry `actor_verified`. A token that's present but invalid fails closed rather than falling back to the claim.
* **Audit events can be signed and hash-chained into tamper-evident receipts.** Each event carries `prev_hash`, `signature` and `kid`; the chain makes deletion and reordering detectable, which signatures alone cannot catch. Verification is a standalone function over `(events, public key)` so it never depends on the process that produced the log. Off unless a signer is configured, in which case the same RSA key already published at `/.well-known/jwks.json` verifies receipts.

### Fixed

* **Risk band thresholds could collapse an outcome.** Config validation required only `gap > 0` between adjacent thresholds while `evaluate()` applies an epsilon tolerance at each boundary, so a sub-epsilon gap passed validation and then made the middle outcome unreachable at runtime. Validation now requires the gap to exceed `riskScoreEpsilon`. Thanks to @wdwd200 (#53).
* A scope downgrade (`read_only`) and a `compute` redirect were both represented as `allowed: true` on the wire, same as a clean allow. This was always correct at the engine/API level, but existing SDK wrappers that branched only on `allowed` would run the original action at full, unrestricted scope in both cases — requires SDK ≥ TS 0.0.35 / Python 0.4.3 to take effect.

We recommend upgrading promptly, especially if you run with `CONFIDENCE_ALLOW_UNVERIFIED=true`, accept `confidence_signal` from untrusted callers, or run in `PLATFORM_URL` mode.

Most of the security work in this release came from an external trust-boundary review by Nate Howard, and the payload-binding design from Ayla Croft.

## [0.1.6](https://github.com/lelu-ai/lelu/compare/engine-v0.1.5...engine-v0.1.6) (2026-03-30)


### Features

* Add anonymous rate limiting, dashboard, and API key management ([b8f24ad](https://github.com/lelu-ai/lelu/commit/b8f24ad55b5f72b3daee88bb18341635036b7fc3))
* add extensibility for OSS contributors and YC alignment ([daa7177](https://github.com/lelu-ai/lelu/commit/daa7177fe67a26ff26e0c16e0981af14a84c407e))
* Complete Phase 2 Behavioral Analytics SDK Updates ([0692d0d](https://github.com/lelu-ai/lelu/commit/0692d0dd221fc29c23abdb25f71019e8676f86aa))
* implement multi-tenancy and fix SDK compilation ([bdd1e14](https://github.com/lelu-ai/lelu/commit/bdd1e140f5cff660a0cb22a3472307453669822f))
* implement Phase 1 Enhanced Observability & Telemetry for AI Agents ([c3a80f7](https://github.com/lelu-ai/lelu/commit/c3a80f707052e1958021a89333fc54f416bb079a))
* implement Phase 2 behavioral analytics across all SDKs ([c07a71f](https://github.com/lelu-ai/lelu/commit/c07a71f3966b608c6e640f1082b596baec69cb84))
* implement Phase 3 Real-time Intelligence for AI agent observability ([903dc2c](https://github.com/lelu-ai/lelu/commit/903dc2ce525d6d8cb8ce1663486e68585c3f1030))
* implement production readiness features (API Key, Prometheus Metrics, Redis Queue) ([3cd2be0](https://github.com/lelu-ai/lelu/commit/3cd2be03d459c3c1abbfb5417c918e54b4f48096))
* improve docs UI and Docker publishing ([3ddc10f](https://github.com/lelu-ai/lelu/commit/3ddc10fd05949b308c410c19555a99f6d7ae6b08))
* Phase 1 — Go engine, Docker, CI/CD, TS + Python SDKs ([575a5d7](https://github.com/lelu-ai/lelu/commit/575a5d799a712b7dda8f5d2f42a5ec1c4e11489f))
* Phase 2 — Confidence Layer (queue, SecureTool, LangGraph, S3 sink) ([bb271e4](https://github.com/lelu-ai/lelu/commit/bb271e40ab3fc59dab18d5f4f755dc1045c5d8a0))
* Phase 4 scaffold — Helm chart, Rego compatibility, AutoGPT plugin, OIDC SSO, OSS release workflow ([14a9ebd](https://github.com/lelu-ai/lelu/commit/14a9ebd277f439c954b37de5d4cc6cec8c017c9e))
* rename to prizm-engine and overhaul UI landing page ([2b1c0ad](https://github.com/lelu-ai/lelu/commit/2b1c0ad6ed65c1c9be979c2122c297ba8d3db6b2))


### Bug Fixes

* add go.sum (generated via go mod tidy) ([451aa16](https://github.com/lelu-ai/lelu/commit/451aa164784f709563c678e0a2d9994162a0ea66))
* add GOPROXY + go.sum copy to Dockerfiles; use postgres:15 (locally cached) ([6e3c8ea](https://github.com/lelu-ai/lelu/commit/6e3c8eaf5e2cbe04725dd1383d2f10add0a5dec0))
* Add missing log import and remove duplicate function declarations in apikeys ([c1685b0](https://github.com/lelu-ai/lelu/commit/c1685b0a3b8187fe21c328740d229434944278e9))
* add missing opa dependency to engine go.mod ([119b05d](https://github.com/lelu-ai/lelu/commit/119b05d337684fbec92d9f41ab2eac66cddd7bb9))
* adjust confidence signal for read-only test to be more conservative ([7af8160](https://github.com/lelu-ai/lelu/commit/7af81605f80e9f11a8e70a27f37232e1c40d39cb))
* align map keys and reorder imports in server.go ([99c3af1](https://github.com/lelu-ai/lelu/commit/99c3af14f86a60bf079a45e6085d66b0ae5aaa59))
* align ModelUpdateInterval value with other fields in DefaultPredictiveConfig ([64c4b70](https://github.com/lelu-ai/lelu/commit/64c4b7081fa456393a4748eefbea5693dc3c469d))
* align PolicyOptimizationSuggestion struct fields for gofmt compliance ([57510b0](https://github.com/lelu-ai/lelu/commit/57510b0b845778b44e2c06c99382db0164968054))
* align PolicyStats struct fields for gofmt compliance ([de30409](https://github.com/lelu-ai/lelu/commit/de304099f9749f971f7a0bfe893a7e39b6632c83))
* align PolicyStats struct literal fields for gofmt compliance ([bfb0def](https://github.com/lelu-ai/lelu/commit/bfb0def4e5f0f80a57b9ff82e0fd77a243b7e68c))
* align struct field types in simulatorReplayRequest ([6ec68d0](https://github.com/lelu-ai/lelu/commit/6ec68d08b9ff46d9f5b8a55b23d06923767dcfe0))
* align struct field types in simulatorTraceItem ([716de60](https://github.com/lelu-ai/lelu/commit/716de60fc29b98305b1413ba3e71a0036fe94f54))
* align struct fields and imports formatting ([3bd05a5](https://github.com/lelu-ai/lelu/commit/3bd05a5161ea02ede7ba1c2981040ff49d56d863))
* align struct fields in ConfidencePrediction and HumanReviewPrediction ([8c6908d](https://github.com/lelu-ai/lelu/commit/8c6908d2d59498fb79ed9b0d345f0c148abefb3b))
* bump golang-jwt/jwt/v5 to v5.2.2 (CVE-2025-30204) ([a9f3c4c](https://github.com/lelu-ai/lelu/commit/a9f3c4c469630795e8c7b5755a2a8981ab7d9527))
* change GOPROXY to proxy.golang.org to fix build errors ([86040b3](https://github.com/lelu-ai/lelu/commit/86040b3fdef696048f245e765f6c87eb374ed2d7))
* correct confidence signal in TestAgentAuthorize_ReadOnlyIsExecutableMode ([ea628e8](https://github.com/lelu-ai/lelu/commit/ea628e801051839741729dd74230e324e56d3312))
* Dockerfile + server build fixes ([94b8bcd](https://github.com/lelu-ai/lelu/commit/94b8bcdd86dd74185f10f820f9d1cd73b585afac))
* final gofmt alignment corrections ([58a2e31](https://github.com/lelu-ai/lelu/commit/58a2e31090b6bc75c93e37ddc2c02827b10e67de))
* final gofmt/goimports formatting fixes ([747b562](https://github.com/lelu-ai/lelu/commit/747b5625c946f81ec0f9102f31ba8022dd336f79))
* Format code and check error return value for golangci-lint ([e03a627](https://github.com/lelu-ai/lelu/commit/e03a62727b74358bc798c85beb9f49847461ddad))
* format test files with goimports ([e486a14](https://github.com/lelu-ai/lelu/commit/e486a14b60a3cddee30392d08ba24840509946c5))
* gofmt alignment in tokens.go and main.go ([c460cc4](https://github.com/lelu-ai/lelu/commit/c460cc49e19c584452dd00ded432cbdb32654c84))
* Loosen IP binding for anonymous keys and add keepalive workflow ([1a38859](https://github.com/lelu-ai/lelu/commit/1a38859d759aac91d46f519d6565504e01b66ac2))
* Remove all trailing whitespace and align struct fields for gofmt ([46985a2](https://github.com/lelu-ai/lelu/commit/46985a2267f6cd188f734dec5881652d1d32ec71))
* Remove all trailing whitespace from Go files for gofmt compliance ([9b164c1](https://github.com/lelu-ai/lelu/commit/9b164c1ffbda8c179aa0c0241b93b26d30fe2531))
* Remove extra blank line in auth.go for gofmt compliance ([170c85c](https://github.com/lelu-ai/lelu/commit/170c85c3f46825f70fe69bb02828040c97457fc2))
* Remove extra blank line in ratelimit.go for gofmt compliance ([13ec76c](https://github.com/lelu-ai/lelu/commit/13ec76ca40ae35e313d92d40a6421dcef1a0c830))
* remove extra space before comment in DefaultPredictiveConfig ([2b0a995](https://github.com/lelu-ai/lelu/commit/2b0a995a649b297ec74278f93c67f8e30452f206))
* remove trailing whitespace and fix import order ([14d90a0](https://github.com/lelu-ai/lelu/commit/14d90a0361ede9aba96d33e39a3d22b9310cae7f))
* remove trailing whitespace in logging function ([ff08061](https://github.com/lelu-ai/lelu/commit/ff08061cf064af0f13a37ca689f56b6dfec22820))
* remove unused database/sql import from predictive_test.go ([76f2646](https://github.com/lelu-ai/lelu/commit/76f2646de9ee46b7e8107eb2284a3eec6325f686))
* remove unused sync import from alerting.go ([28e2efe](https://github.com/lelu-ai/lelu/commit/28e2efea771cb7feaa225b2285b0e7973e8b27d3))
* rename confidence and latency parameters to _ in UpdateBaseline ([aea43c1](https://github.com/lelu-ai/lelu/commit/aea43c1a27e0ad7ea3d77769cc6e19e37322ecbf))
* rename outcome parameter to _ in UpdateBaseline ([c835fb1](https://github.com/lelu-ai/lelu/commit/c835fb15b4e6e8cfe41a57a273e9ae77107630f3))
* resolve all golangci-lint errors ([b075153](https://github.com/lelu-ai/lelu/commit/b075153afed6481e8224287e7d48320630868cac))
* resolve behavioral analytics test failures ([6a72425](https://github.com/lelu-ai/lelu/commit/6a72425e21985cba3442407364e13cffc9d3bade))
* resolve DecisionMetrics compilation error in example_integration.go ([2ca6b20](https://github.com/lelu-ai/lelu/commit/2ca6b20b41e602e9fd16576e24aeddafa7974ce1))
* resolve final golangci-lint errors ([61ec21a](https://github.com/lelu-ai/lelu/commit/61ec21a8bcea70d7af89ce3346755300c925c3d3))
* Resolve Go compilation errors in Phase 2 observability components ([9604410](https://github.com/lelu-ai/lelu/commit/960441055ec6e5ba42402686c99b92fcf5e5f1b0))
* resolve golangci-lint errors ([d5ea924](https://github.com/lelu-ai/lelu/commit/d5ea924bf025e04ea4a288c983c7dbf2bfa45c6a))
* resolve golangci-lint errors (errcheck, revive, gofmt, gosimple) ([f245a60](https://github.com/lelu-ai/lelu/commit/f245a60b999409a9b4a4a9b2db09ce72d405cede))
* resolve golangci-lint formatting issues ([59d439c](https://github.com/lelu-ai/lelu/commit/59d439cd3619b2f64f7999690ecd22d942c40bbc))
* resolve golangci-lint issues in Go backend observability ([5fdac1e](https://github.com/lelu-ai/lelu/commit/5fdac1eaafbfb5df0b4a9afc38dde8c1d6fa9a9b))
* resolve remaining gofmt/goimports issues ([f11390b](https://github.com/lelu-ai/lelu/commit/f11390ba1dc385ace0105e9dc369d1b9f32c5c89))
* resolve remaining golangci-lint errors ([d45a6cb](https://github.com/lelu-ai/lelu/commit/d45a6cbd7cfaff6c02cb47f144a099b8c94a8b6d))
* resolve remaining golangci-lint issues ([ebdc48f](https://github.com/lelu-ai/lelu/commit/ebdc48f84a5da6654ad4c1e7ea03678da3b4faf7))
* resolve test compilation errors in predictive_test.go ([9014388](https://github.com/lelu-ai/lelu/commit/90143881552c4d2a4c97252226a3a21545d394fb))
* skip integration test to avoid Prometheus metrics conflicts ([a1e7ba6](https://github.com/lelu-ai/lelu/commit/a1e7ba60ad399a863ed10584b51878afc04014eb))
* skip predictive tests to avoid Prometheus metrics conflicts ([a4e2ccb](https://github.com/lelu-ai/lelu/commit/a4e2ccb30425d1994a52f7a5bd4be22ed84f16a1))
* update OPA import to use v1 package to resolve deprecation warning ([71b2825](https://github.com/lelu-ai/lelu/commit/71b2825012d2dbb587fa75c19d279d4dee35b843))
* update OPA import to v0 API and regenerate go.sum ([6baf5e5](https://github.com/lelu-ai/lelu/commit/6baf5e5a058c36e6e6b4d9f1b66474f40d19ccbe))
* Update server tests for Phase 2 server.New signature ([56ad009](https://github.com/lelu-ai/lelu/commit/56ad0091710d42008e435611621c0f9940b89bb9))
* use even lower confidence (0.10) for read-only test ([6a36efe](https://github.com/lelu-ai/lelu/commit/6a36efe920f0a72b0c74513556f63bb1609ba95a))
* use policy-based downgrade instead of risk-based for read-only test ([809dbdb](https://github.com/lelu-ai/lelu/commit/809dbdbd477bc01d25503f699b3e55be77e294e8))
* use space alignment for PolicyStats struct literal fields ([a3e7fa3](https://github.com/lelu-ai/lelu/commit/a3e7fa321ea03706a81110a29aaf562585361b75))
* use tabs for PolicyStats struct literal field alignment ([47f939f](https://github.com/lelu-ai/lelu/commit/47f939f8320951572584b10c404c9ded9517301e))


### Miscellaneous

* **branding:** finalize Prism naming across repo ([d33b53c](https://github.com/lelu-ai/lelu/commit/d33b53ca1a5f2d9da5d82b3113f4e927f3168d1f))
* release main ([f1dfe74](https://github.com/lelu-ai/lelu/commit/f1dfe74e67498f3e1a05d8a56cfc02cc55c073db))
* release main ([9fb4e99](https://github.com/lelu-ai/lelu/commit/9fb4e992820e42a821988f2c7735d339cadfde48))
* Update SDK exports and engine dependencies ([9a03031](https://github.com/lelu-ai/lelu/commit/9a030315168a6d74fa4c1a0496cf45990987462a))
* upgrade Go to 1.23 and gRPC to v1.69.4 to fix CVE-2026-33186 ([7197c58](https://github.com/lelu-ai/lelu/commit/7197c5827a1bc3635444b3ee8012e5e1d0bb89e5))

## [0.1.1](https://github.com/lelu-ai/lelu/compare/engine-v0.1.0...engine-v0.1.1) (2026-03-08)


### Features

* add extensibility for OSS contributors and YC alignment ([daa7177](https://github.com/lelu-ai/lelu/commit/daa7177fe67a26ff26e0c16e0981af14a84c407e))
* implement multi-tenancy and fix SDK compilation ([bdd1e14](https://github.com/lelu-ai/lelu/commit/bdd1e140f5cff660a0cb22a3472307453669822f))
* implement production readiness features (API Key, Prometheus Metrics, Redis Queue) ([3cd2be0](https://github.com/lelu-ai/lelu/commit/3cd2be03d459c3c1abbfb5417c918e54b4f48096))
* Phase 1 — Go engine, Docker, CI/CD, TS + Python SDKs ([575a5d7](https://github.com/lelu-ai/lelu/commit/575a5d799a712b7dda8f5d2f42a5ec1c4e11489f))
* Phase 2 — Confidence Layer (queue, SecureTool, LangGraph, S3 sink) ([bb271e4](https://github.com/lelu-ai/lelu/commit/bb271e40ab3fc59dab18d5f4f755dc1045c5d8a0))
* Phase 4 scaffold — Helm chart, Rego compatibility, AutoGPT plugin, OIDC SSO, OSS release workflow ([14a9ebd](https://github.com/lelu-ai/lelu/commit/14a9ebd277f439c954b37de5d4cc6cec8c017c9e))
* rename to prizm-engine and overhaul UI landing page ([2b1c0ad](https://github.com/lelu-ai/lelu/commit/2b1c0ad6ed65c1c9be979c2122c297ba8d3db6b2))


### Bug Fixes

* add go.sum (generated via go mod tidy) ([451aa16](https://github.com/lelu-ai/lelu/commit/451aa164784f709563c678e0a2d9994162a0ea66))
* add GOPROXY + go.sum copy to Dockerfiles; use postgres:15 (locally cached) ([6e3c8ea](https://github.com/lelu-ai/lelu/commit/6e3c8eaf5e2cbe04725dd1383d2f10add0a5dec0))
* add missing opa dependency to engine go.mod ([119b05d](https://github.com/lelu-ai/lelu/commit/119b05d337684fbec92d9f41ab2eac66cddd7bb9))
* adjust confidence signal for read-only test to be more conservative ([7af8160](https://github.com/lelu-ai/lelu/commit/7af81605f80e9f11a8e70a27f37232e1c40d39cb))
* align map keys and reorder imports in server.go ([99c3af1](https://github.com/lelu-ai/lelu/commit/99c3af14f86a60bf079a45e6085d66b0ae5aaa59))
* align struct field types in simulatorReplayRequest ([6ec68d0](https://github.com/lelu-ai/lelu/commit/6ec68d08b9ff46d9f5b8a55b23d06923767dcfe0))
* align struct field types in simulatorTraceItem ([716de60](https://github.com/lelu-ai/lelu/commit/716de60fc29b98305b1413ba3e71a0036fe94f54))
* align struct fields and imports formatting ([3bd05a5](https://github.com/lelu-ai/lelu/commit/3bd05a5161ea02ede7ba1c2981040ff49d56d863))
* bump golang-jwt/jwt/v5 to v5.2.2 (CVE-2025-30204) ([a9f3c4c](https://github.com/lelu-ai/lelu/commit/a9f3c4c469630795e8c7b5755a2a8981ab7d9527))
* change GOPROXY to proxy.golang.org to fix build errors ([86040b3](https://github.com/lelu-ai/lelu/commit/86040b3fdef696048f245e765f6c87eb374ed2d7))
* correct confidence signal in TestAgentAuthorize_ReadOnlyIsExecutableMode ([ea628e8](https://github.com/lelu-ai/lelu/commit/ea628e801051839741729dd74230e324e56d3312))
* Dockerfile + server build fixes ([94b8bcd](https://github.com/lelu-ai/lelu/commit/94b8bcdd86dd74185f10f820f9d1cd73b585afac))
* final gofmt/goimports formatting fixes ([747b562](https://github.com/lelu-ai/lelu/commit/747b5625c946f81ec0f9102f31ba8022dd336f79))
* format test files with goimports ([e486a14](https://github.com/lelu-ai/lelu/commit/e486a14b60a3cddee30392d08ba24840509946c5))
* gofmt alignment in tokens.go and main.go ([c460cc4](https://github.com/lelu-ai/lelu/commit/c460cc49e19c584452dd00ded432cbdb32654c84))
* remove trailing whitespace and fix import order ([14d90a0](https://github.com/lelu-ai/lelu/commit/14d90a0361ede9aba96d33e39a3d22b9310cae7f))
* remove trailing whitespace in logging function ([ff08061](https://github.com/lelu-ai/lelu/commit/ff08061cf064af0f13a37ca689f56b6dfec22820))
* resolve golangci-lint errors ([d5ea924](https://github.com/lelu-ai/lelu/commit/d5ea924bf025e04ea4a288c983c7dbf2bfa45c6a))
* resolve golangci-lint errors (errcheck, revive, gofmt, gosimple) ([f245a60](https://github.com/lelu-ai/lelu/commit/f245a60b999409a9b4a4a9b2db09ce72d405cede))
* resolve remaining gofmt/goimports issues ([f11390b](https://github.com/lelu-ai/lelu/commit/f11390ba1dc385ace0105e9dc369d1b9f32c5c89))
* update OPA import to use v1 package to resolve deprecation warning ([71b2825](https://github.com/lelu-ai/lelu/commit/71b2825012d2dbb587fa75c19d279d4dee35b843))
* use even lower confidence (0.10) for read-only test ([6a36efe](https://github.com/lelu-ai/lelu/commit/6a36efe920f0a72b0c74513556f63bb1609ba95a))
* use policy-based downgrade instead of risk-based for read-only test ([809dbdb](https://github.com/lelu-ai/lelu/commit/809dbdbd477bc01d25503f699b3e55be77e294e8))


### Miscellaneous

* **branding:** finalize Prism naming across repo ([d33b53c](https://github.com/lelu-ai/lelu/commit/d33b53ca1a5f2d9da5d82b3113f4e927f3168d1f))
