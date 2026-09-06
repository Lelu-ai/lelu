# Changelog

## [0.3.7](https://github.com/Lelu-ai/lelu/compare/python-sdk-v0.3.6...python-sdk-v0.3.7) (2026-09-06)


### Features

* Add anonymous rate limiting, dashboard, and API key management ([4842938](https://github.com/Lelu-ai/lelu/commit/4842938dc95676effc4ea78a69c42f6282914c70))
* Add built-in CLI audit-log command to all SDKs ([1438b23](https://github.com/Lelu-ai/lelu/commit/1438b2356f47dab8e4696a7fcbffa66e3ac4f73e))
* Add comprehensive CLI functionality to all SDKs ([0e0a5d3](https://github.com/Lelu-ai/lelu/commit/0e0a5d3b64bbfa16020172e99a39f32b5801d24b))
* add LangChain tool authorization wrapper ([dda6280](https://github.com/Lelu-ai/lelu/commit/dda628077235b5095428339eb484f26a7ad1735e))
* add LangChain tool authorization wrapper ([2c3b7c9](https://github.com/Lelu-ai/lelu/commit/2c3b7c9743a135137a7b31e922962bb160e3d5a1))
* Add SQLite local storage for all SDKs ([10bf96e](https://github.com/Lelu-ai/lelu/commit/10bf96e89aca024032a2c0de894da720ef00a72a))
* Complete Phase 2 Behavioral Analytics SDK Updates ([6d63112](https://github.com/Lelu-ai/lelu/commit/6d63112231d885126da27f6333720af42371fc92))
* **engine:** OAuth Token Vault — Feature 1 complete ([b73f4f8](https://github.com/Lelu-ai/lelu/commit/b73f4f8c4323d26e2506d379034bf6cecd3c3f7e))
* fix SDK tab link and remove Go SDK from UI ([b57bbc4](https://github.com/Lelu-ai/lelu/commit/b57bbc47353b4d0111e185ee64ce54677d174f1b))
* implement Phase 1 Enhanced Observability & Telemetry for AI Agents ([895c74f](https://github.com/Lelu-ai/lelu/commit/895c74f019d4ca3e20abc8c107833e6486a93a98))
* implement Phase 3 Real-time Intelligence for AI agent observability ([f50bc4b](https://github.com/Lelu-ai/lelu/commit/f50bc4bf972095dccb8825ba3094178dd64f850f))
* **python-sdk:** expose approval redemption via wait_and_redeem ([6e04bee](https://github.com/Lelu-ai/lelu/commit/6e04bee24ac8ee63819b351359a7f03d6f9ae807))
* release Python SDK v0.3.6 with hosted engine integration ([0862203](https://github.com/Lelu-ai/lelu/commit/08622032bdc39c3ebc2c7c3f69126cf8c3be6e26))
* release TypeScript SDK v0.2.7 with hosted engine integration ([34cac33](https://github.com/Lelu-ai/lelu/commit/34cac33eaa78abdf9ff5226a046784fdb4069ac1))
* **sdk-python:** 0.4.0 — align with current engine API ([b016b17](https://github.com/Lelu-ai/lelu/commit/b016b1757617eed43e8732b3121ed7e4397b7019))
* **sdk-python:** lelu() factory + zero-config local engine discovery ([db7b7b0](https://github.com/Lelu-ai/lelu/commit/db7b7b0ca58a46aa9e6f0c14d1a8c635cdf36b20))
* **sdk/python:** add COMPUTE decision — safe alternative routing (v0.3.62) ([8f652d9](https://github.com/Lelu-ai/lelu/commit/8f652d94cd7070e4f37859b0381270b5aaff873e))
* **sdk/python:** bump to 0.3.65 — add agent registry, NHI, MCP OAuth methods ([615d4bb](https://github.com/Lelu-ai/lelu/commit/615d4bbd6a3cb38b57ac2c3c46beaa28a6f29722))
* **sdk/python:** bump to v0.3.63 — forensic hash/digest fields aligned with engine ([c204f3b](https://github.com/Lelu-ai/lelu/commit/c204f3bc15fc20a8d2ae2589203e307c99d9be13))
* **sdk:** add Strands Agents integration for Python and TypeScript ([23f3dcb](https://github.com/Lelu-ai/lelu/commit/23f3dcb0f3a3988a7926235e644b720be35cb122))
* **sdk:** bump TS to v0.0.20, Python to v0.3.64 — OAuth Token Vault ([1efed34](https://github.com/Lelu-ai/lelu/commit/1efed3421f1333066ce50776161827f8a6534b2d))
* **sdk:** close TS/Python SDK parity gaps + backfill changelogs ([ae42b0e](https://github.com/Lelu-ai/lelu/commit/ae42b0ee9664a0d7626b2c99d14403b1a395bb24))


### Bug Fixes

* Add type annotations to LocalStorage context manager methods ([81201c5](https://github.com/Lelu-ai/lelu/commit/81201c5389b25ec89f10a00047a39053342eea3a))
* Improve error handling in Python SDK CLI ([140ca45](https://github.com/Lelu-ai/lelu/commit/140ca45889e5cd1fd53cdda53cebb89cabe2877a))
* **platform:** align all layers with engine compute/hash/digest features ([77b548b](https://github.com/Lelu-ai/lelu/commit/77b548b020335165f451d8675d05b44f34b56265))
* **python-sdk:** take the decision object for redemption, not a bare ID ([e54a24f](https://github.com/Lelu-ai/lelu/commit/e54a24f9a7272618c589e381d4c95914c865c333))
* resolve final mypy errors in Python SDK observability ([8fff4da](https://github.com/Lelu-ai/lelu/commit/8fff4da2fcea71beb240abfb97752313a7aacc3f))
* resolve mypy redefinition errors in Python SDK observability ([43e052c](https://github.com/Lelu-ai/lelu/commit/43e052c00bb6b1bfaaa7bda9f87f6f3cf92177d4))
* resolve mypy type checking errors in Python SDK observability ([626f5e1](https://github.com/Lelu-ai/lelu/commit/626f5e169391992bc087b199e15d3090c14af241))
* Resolve mypy type errors in Python SDK Phase 2 methods ([f7d39db](https://github.com/Lelu-ai/lelu/commit/f7d39db603e9b8badd284a36645eb0b7515f2c99))
* **sdk-python:** silence mypy no-any-return on raw-payload engine status methods ([12c215d](https://github.com/Lelu-ai/lelu/commit/12c215de967d96d7837f0dac51dd7c509e5e2493))
* **sdk-python:** skip test_fastapi.py gracefully when fastapi isn't installed ([50ee7eb](https://github.com/Lelu-ai/lelu/commit/50ee7eb9570c9df4e470ac292d239a2ed0744c2a))
* **sdk/python:** add generic type args to safe_args dict for mypy ([9898e0f](https://github.com/Lelu-ai/lelu/commit/9898e0f59addf221e5d582964b779a7dbe2149d3))
* **sdk/python:** align authorize() with engine API + bump to 0.3.66 ([dab1d3c](https://github.com/Lelu-ai/lelu/commit/dab1d3c6032282942588275fd53db09e7403769b))
* **sdk/python:** change latency_ms from int to float in AuthDecision and AuditEvent ([c8ccf27](https://github.com/Lelu-ai/lelu/commit/c8ccf27a1ac5150d6a9fd3f8ca9e2ed1b870bd71))
* **sdk/python:** fix mypy errors in client.py and observability.py ([fa4ec9b](https://github.com/Lelu-ai/lelu/commit/fa4ec9b87aa359f3bf3a0abff47068465b81db9c))
* **sdk/python:** fix mypy unused-ignore in observability.py ([b56bc5f](https://github.com/Lelu-ai/lelu/commit/b56bc5fbfa04c4fdd4ead388acf99eacad0ab09f))
* **sdk/python:** satisfy mypy in LangChain fallback base tool ([489e2f4](https://github.com/Lelu-ai/lelu/commit/489e2f4179f073d534ddc7591e545518d2e106ec))
* **sdk/python:** update tests to match new API shapes ([1b6906f](https://github.com/Lelu-ai/lelu/commit/1b6906f0ff25a0f0d94c9b56561a0b4dd02dbc83))
* **sdk:** align all layers with engine vault — 6 issues resolved ([d29ff2d](https://github.com/Lelu-ai/lelu/commit/d29ff2d0fe5c8b1848c53d7a991989148a565217))
* **sdk:** correct SimulatorDecision.outcome literal to match the engine ([a85360a](https://github.com/Lelu-ai/lelu/commit/a85360a133373d9a1e8dd72f03c4c4e493fdfab9))
* **sdk:** forward actor to the engine (TS 0.0.29, Python 0.3.67) ([5108f96](https://github.com/Lelu-ai/lelu/commit/5108f963ee2e29757bcebd316fd392857704ebb1))
* **sdk:** make both CI gates pass — mypy on the Strands module, tsc on openai ([bbd9cdf](https://github.com/Lelu-ai/lelu/commit/bbd9cdfc8af81fa0e1d66315e0430da7d6eba94f))
* **sdk:** rewrite the Strands integration against the real intervention API ([6c0c590](https://github.com/Lelu-ai/lelu/commit/6c0c590e3aee6a27e6725daa53f15e14f51415e2))
* **sdk:** stop the Strands tests breaking collection without strands-agents ([88fd4e8](https://github.com/Lelu-ai/lelu/commit/88fd4e874561e6c2eb4d2247d671ea885a91d03f))
* **security:** correct four confidence/enforcement bugs across engine and SDKs ([73498cb](https://github.com/Lelu-ai/lelu/commit/73498cb0c7896f9b12fafab9dbfc4d38c1833f3a))


### Documentation

* Add Docker deployment documentation and update SDK packages ([1ad35a4](https://github.com/Lelu-ai/lelu/commit/1ad35a4956f1a5bd5ce904f9a21d29601b607ea4))
* add Docker Hub engine usage across READMEs ([a6fbd98](https://github.com/Lelu-ai/lelu/commit/a6fbd98587ea48e3100d5bfe9f9585c512c68e27))
* add LangChain authorization example ([69f1000](https://github.com/Lelu-ai/lelu/commit/69f1000767aad5b04b30538e5f2d493f3a4fd2c6))
* **sdk:** correct the changelogs to the API that actually ships ([ff945d0](https://github.com/Lelu-ai/lelu/commit/ff945d0114eccce98831fc61982faa3221c36850))


### Miscellaneous

* bump Python SDK to v0.2.0 for PyPI publication ([7dff874](https://github.com/Lelu-ai/lelu/commit/7dff8746a3e8aa0251d165307e92386351240ec7))
* bump version to 0.0.5 and add author information ([2aa4d09](https://github.com/Lelu-ai/lelu/commit/2aa4d09e1848f2d22c46611f8cd1cb9c313328bf))
* migrate repo references from lelu-auth to lelu-ai ([2b8a524](https://github.com/Lelu-ai/lelu/commit/2b8a524613376750e89df272597176fde9930fc1))
* **python-sdk:** release 0.4.4 ([450221a](https://github.com/Lelu-ai/lelu/commit/450221aade022bc9815cb3e754161021e9de7363))
* release main ([f2a4977](https://github.com/Lelu-ai/lelu/commit/f2a4977604033c428c6a223d8e0d1328383a2826))
* **release:** prepare engine 0.2.0 and python-sdk 0.5.0 ([904788e](https://github.com/Lelu-ai/lelu/commit/904788ebdff5b3cd07fb1a42f7ef2af0667170cb))
* remove Docker Hub deployment and references ([2cbf98a](https://github.com/Lelu-ai/lelu/commit/2cbf98a2f5bf495074699a73e69bd8c8eebc79c3))
* replace all old engine URLs with lelu-ai.com ([09cc1db](https://github.com/Lelu-ai/lelu/commit/09cc1dbed11e5f1abf84ce414bee21e7d1e270bc))
* **sdk:** release python 0.4.41 and typescript 0.0.36 ([5e7dfe1](https://github.com/Lelu-ai/lelu/commit/5e7dfe19e5d5c2d4fc4efb646aefd4968d15de88))
* **sdk:** stop tracking stale Python build artifacts ([73afc66](https://github.com/Lelu-ai/lelu/commit/73afc665bee91786723985f738f25960d678a4cc))
* Update SDK exports and engine dependencies ([25e6f32](https://github.com/Lelu-ai/lelu/commit/25e6f32c49d87891f3ca3e9bed6e004f770c235b))

## [0.4.41] (2026-09-04)

### Features

* **Strands Agents integration** (`lelu.strands`). `LeluIntervention` is an
  `InterventionHandler` — register it with `Agent(interventions=[...])` and every
  tool call is authorized before it runs. Lelu's four decisions map onto actions
  Strands already has, so this is a mapping rather than a translation:

  | Lelu | Strands | Effect |
  |---|---|---|
  | `allow` | `Proceed` | the tool runs as the model intended |
  | `deny` | `Deny` | cancelled; the model is told why and can choose again |
  | `compute` | `Transform` | re-pointed at the safe tool the policy names |
  | `human_review` | `Confirm` | paused for a human via Strands' interrupt system |

* **`Confirm` for human review.** A person has to decide, and Strands already has
  the machinery to pause for one — so the integration does not have to cancel the
  call and hope the caller resumes it. Set `on_review="deny"` if approval lives in
  Lelu's own review queue instead, and resume with `LeluIntervention.redeem()`,
  which replays the exact request that was paused rather than rebuilding one.
* `action_for` maps tool names to policy permissions when your policy uses a
  different vocabulary; `confidence_for` supplies a confidence signal when you have
  a real one.

### Behaviour worth knowing

* **Two failures, both closed by default.** If the engine is unreachable the call
  is denied (`fail_open=True` overrides). If the handler itself throws, `on_error`
  defaults to `"deny"` — Strands' own default is `"throw"`, and a broken
  authorization check should block a tool call rather than surface as an unhandled
  error.
* **Confidence is omitted unless supplied**, leaving the engine's
  `MissingSignalMode` to decide rather than the integration inventing a perfect
  score.
* A `compute` decision is detected before `allowed` is read, because the engine
  reports compute as not-allowed *for the tool that was requested*. Reading
  `allowed` first would turn every redirect into a denial.

## [0.4.4] (2026-09-03)

**Requires engine ≥ 0.2.0.** The redemption endpoint this release calls does not exist in earlier engines — `wait_and_redeem()` against an older engine will 404. (If you were waiting on engine `0.1.1` for the `review_id` fix in 0.4.3: that was never tagged, and everything it covered shipped in `0.2.0` instead.)

### Features

* **`wait_and_redeem()` — the path you want after a `human_review` decision.** Waiting for an approval only tells you a reviewer said yes to *something*; it doesn't bind that yes to what you execute next. This waits for the decision, then re-checks your request against the one that was actually approved, so a payload altered in between is refused instead of riding a valid approval. Returns `allowed=False` with a reason for timeout, denial, or mismatch, so there's one thing to check rather than three.
* **`redeem_review()`** for callers driving the wait themselves, and a `RedeemResult` model. Refusal comes back as a result, not an exception — "not allowed" is an answer.
* Both accept the `AuthDecision` you got from `authorize()` as well as a raw review ID. Prefer passing the decision: it carries both `request_id` (trace) and `review_id` (queue key), and reaching for "the request's ID" gets the wrong one with no symptom until redemption fails. Passing the decision removes the choice. An `AuthDecision` with no `review_id` now raises with an explanation rather than building a broken URL.
* `LeluInstance.wait_and_redeem()` on the ergonomic `auth.*` API, with the default actor applied.

### Fixed

* `AuthDecision.request_id`'s description said "Unique request identifier", which is exactly what you reach for when you want your request's ID — and it's the trace ID, not the review handle. It now says what it is and points at `review_id`.

## [0.4.3] (2026-08-01)

### Security Fixes

* **Enforcement inversion on scope downgrade / compute redirect.** `agent_authorize()` explicitly discarded `downgraded_scope`, `safe_tool`, and `safe_args` before they ever reached a caller. As a result, `SecuredTool`, `secure_node`, the FastAPI `Authorize` dependency, and `AgentMiddleware.authorize_action()` all branched only on `decision.allowed`, which the engine also sets to `true` for a `read_only` downgrade or a `compute` redirect. All four ran the wrapped tool/node/endpoint at full, unrestricted scope instead of respecting the restriction. `agent_authorize()` now correctly forwards these fields, and all four now refuse to execute/proceed unless the decision is a clean allow.
* **Unaddressable human-review decisions.** `AuthDecision` now carries `review_id` (from the engine's new `review_id` field), and `secure_node` surfaces it via the previously-unused `_REVIEW_ID_KEY` state key (new `review_id(state)` helper), so a `human_review` decision can actually be resolved via `get_review()`/`wait_review()`/`approve_review()`/`deny_review()` instead of only carrying an unresolvable reason string.

Requires engine ≥ 0.1.1 for the confidence-verification and review-ID fixes to take effect. We recommend upgrading promptly if you use `SecuredTool`, `secure_node`, the FastAPI `Authorize` dependency, or `AgentMiddleware` against a policy with `read_only` downgrades or `compute` redirects.

## [0.4.2] (2026-07-31)

### Features — parity with the TypeScript SDK

* **Policy simulator** — `simulator_replay(req)` (`POST /v1/simulator/replay`) replays historical traces against a proposed policy to preview its impact before promoting it live. New `SimulatorTraceItem`, `SimulatorDecision`, `SimulatorReplayDelta`, `SimulatorReplaySummary`, `SimulatorReplayRequest`, `SimulatorReplayResponse` models.
* **`LeluClient.confidence_from`** — derives a verified confidence score from an LLM provider response: `.openai(response)` (chat-completion logprobs) and `.bedrock(response)` (Cohere `token_likelihoods`, or a passed-through logprobs list). `.anthropic(response)` always returns `None` — Anthropic exposes no token-level log-probs. All three return `None` rather than a fabricated default when no signal is present, so the engine's `MissingSignalMode` decides.
* **`lelu().handler`** — an ASGI 3 application on the shared `LeluInstance`, mountable with `app.mount("/api/lelu", auth.handler)` in FastAPI/Starlette. Exposes `POST /authorize`, `GET /queue`, `POST /queue/{id}/approve`, `POST /queue/{id}/deny`, and `GET /ok`, so a browser-facing approval UI never sees the engine URL or API key. Mirrors the TypeScript SDK's fetch-style `lelu().handler`.

## [0.4.1] (2026-07-13)

### Features

* **`lelu(actor=...)` shared-instance factory** — parity with the TypeScript SDK: `.api` exposes the full `LeluClient`, and `.authorize()` fills in a default `actor` when the request omits one.
* **`discover_local_engine()`** — connects automatically to the engine `npx lelu-mcp start` runs locally, reading `~/.lelu/engine.json` + `~/.lelu/engine.key` with a PID-liveness check before trusting them.

### Bug Fixes

* **`is_healthy()` now probes the right endpoint.** It was hitting `/api/config-check` (a platform route) and always returned `False` against a real engine; it now probes the engine's `/healthz`.

## [0.4.0] (2026-07-13)

### Features — full alignment with the current engine API

* **Human-review queue client** — the engine's HITL endpoints are now first-class: `list_pending_reviews()`, `get_review(id)`, `wait_review(id, timeout_ms)` (long-poll until a human approves/denies; engine caps each wait at 60s), `approve_review(id, resolved_by, note)` and `deny_review(...)`. New `ReviewItem` / `ListReviewsResult` models mirror the engine's queue item exactly (`confidence_score`, `acting_for`, `enqueued_at`, `status`, `resolved_by`, `resolution_note`, …).
* **Output scanning** — `scan_output(output, actor?, action?, resource?)` calls `POST /v1/scan/output` (indirect prompt-injection defense) and returns `ScanOutputResult` (`safe`, `detected`, `pattern`, `source`, `method`, `score`).
* **Engine policy management** — `get_engine_policy()` (`GET /v1/policy`), `validate_policy(bytes)` (`POST /v1/policy/validate`), and `put_engine_policy(bytes, if_match=digest)` (`PUT /v1/policy`, admin key + optimistic concurrency via `If-Match`). These target the engine's live policy — distinct from the platform policy CRUD, which is unchanged.
* **Engine status** — `fallback_status()` (`GET /v1/fallback/status`) and `shadow_summary()` (`GET /v1/shadow/summary`).

### Improvements

* **`AuthDecision` now parses the engine's complete response** — added `confidence_used`, `effective_scope`, `downgraded_scope`, `risk_score`, `risk_criticality`, `risk_reliability`, `risk_anomaly_factor`, `shadow_mode`, and the shadow-mode `would_have_allowed` / `would_have_reason` / `would_have_requires_human_review` fields. Previously these were silently dropped.
* **`AuthorizeRequest` gains `resource` and `tenant_id`** — both are accepted by `POST /v1/agent/authorize` and forwarded when set (previously there was no way to send a target resource through the primary API).


## [0.3.67] (2026-06-16)

### Bug Fixes

* **`actor` now reaches the engine.** `authorize()` and `agent_authorize()` never sent the `actor` field, so the engine always saw an empty actor and denied every request with `unknown agent scope ""` — meaning **no `agent_scopes` policy could be matched through the SDK**. `AuthorizeRequest` now carries an optional `actor`, and `agent_authorize()` forwards it. Mirrors the TS SDK 0.0.29 fix.

## [0.3.66] (2026-06-15)

### Bug Fixes

* **`authorize()` aligned with the engine API** — previously POSTed `{tool, context, args}` to the platform path `/api/v1/authorize`; now POSTs `{action, confidence?, acting_for?, scope?, args?}` to the engine's actual agent-authorization handler `POST /v1/agent/authorize`. The decision is derived from the engine's `allowed` / `requires_human_review` / `compute` flags, and `trace_id` / `safe_tool` / `safe_args` / `input_hash` / `output_hash` / `policy_digest` are mapped through. Mirrors the TS SDK 0.0.28 fix.
* **`agent_authorize()` no longer drops context** — it built `AuthorizeRequest(tool=action)` and discarded the `AgentContext`, so confidence, `acting_for` and `scope` never reached the engine. It now forwards the full context.
* **`AuthorizeRequest.context`** is now the structured `AgentContext` model (was a free-form `str`); `AgentContext` is defined before `AuthorizeRequest` so the annotation resolves under `from __future__ import annotations`.

### Behavior Changes

* **Confidence is no longer fabricated.** `AgentContext.confidence` is now optional and omitted from the request when absent, so the engine's `MissingSignalMode` decides instead of a hardcoded `1.0`. The `langgraph` (`default_confidence`), `crewai` (`confidence`) and `fastapi` (`confidence`) wrappers now default to `None`. Mirrors the TS SDK confidence-defaults fix. **Note:** if your engine runs with the default missing-confidence mode (`deny`), you must now pass a real `confidence` or set `CONFIDENCE_MISSING_MODE=review` on the engine during development.
* `__version__` corrected (was stale at `0.3.62`).

## [0.3.64] (2026-06-03)

### Features

* **OAuth Token Vault** — full vault support: `vault_store()`, `vault_get_token()`, `vault_revoke()`, `vault_list()`, `vault_providers()`
* New models exported from package root: `VaultStoreRequest`, `VaultStoreResult`, `VaultTokenResult`, `VaultCredentialSummary`
* `VaultTokenResult.refreshed` — true when engine transparently refreshed the access token
* `VaultCredentialSummary.expired` — boolean flag when stored token is past expiry

### Bug Fixes

* `observability.py` — fixed mypy `unused-ignore` and `no-redef` errors by declaring `otel_trace`, `OtelStatus`, `OtelStatusCode` as `Any` before the try/except block
* `vault_revoke()` return value cast to `bool()` to satisfy mypy strict return type

## [0.3.63] (2026-06-01)

### Features

* `AuthDecision` extended with forensic fields: `input_hash`, `output_hash`, `policy_digest` — surfaced from engine response for tamper-proof verification
* `AuditEvent.decision` description updated to include `"compute"` — aligns with engine's four-decision model
* `AuditEvent` extended with `input_hash`, `output_hash`, `policy_digest` optional fields

## [0.3.6](https://github.com/lelu-ai/lelu/compare/python-sdk-v0.3.5...python-sdk-v0.3.6) (2026-03-30)


### Features

* Add anonymous rate limiting, dashboard, and API key management ([b8f24ad](https://github.com/lelu-ai/lelu/commit/b8f24ad55b5f72b3daee88bb18341635036b7fc3))
* Add built-in CLI audit-log command to all SDKs ([0943686](https://github.com/lelu-ai/lelu/commit/094368663337c0f6844b8b159aabfe53ebe79ccf))
* Add comprehensive CLI functionality to all SDKs ([61f292b](https://github.com/lelu-ai/lelu/commit/61f292bd35eb806d3812bb8e593ddebb3dac8db4))
* add extensibility for OSS contributors and YC alignment ([daa7177](https://github.com/lelu-ai/lelu/commit/daa7177fe67a26ff26e0c16e0981af14a84c407e))
* Add SQLite local storage for all SDKs ([e38a67a](https://github.com/lelu-ai/lelu/commit/e38a67afd4e32c8b3b2966e378e918773f404ee3))
* Complete Phase 2 Behavioral Analytics SDK Updates ([0692d0d](https://github.com/lelu-ai/lelu/commit/0692d0dd221fc29c23abdb25f71019e8676f86aa))
* implement Phase 1 Enhanced Observability & Telemetry for AI Agents ([c3a80f7](https://github.com/lelu-ai/lelu/commit/c3a80f707052e1958021a89333fc54f416bb079a))
* implement Phase 3 Real-time Intelligence for AI agent observability ([903dc2c](https://github.com/lelu-ai/lelu/commit/903dc2ce525d6d8cb8ce1663486e68585c3f1030))
* Phase 1 — Go engine, Docker, CI/CD, TS + Python SDKs ([575a5d7](https://github.com/lelu-ai/lelu/commit/575a5d799a712b7dda8f5d2f42a5ec1c4e11489f))
* Phase 2 — Confidence Layer (queue, SecureTool, LangGraph, S3 sink) ([bb271e4](https://github.com/lelu-ai/lelu/commit/bb271e40ab3fc59dab18d5f4f755dc1045c5d8a0))
* Phase 3 — Cloud Platform, Trace Explorer UI, React hook, FastAPI/Express middleware ([b3ea833](https://github.com/lelu-ai/lelu/commit/b3ea83306d2744f7fdeed00d70d7c75966ff6160))
* Phase 4 scaffold — Helm chart, Rego compatibility, AutoGPT plugin, OIDC SSO, OSS release workflow ([14a9ebd](https://github.com/lelu-ai/lelu/commit/14a9ebd277f439c954b37de5d4cc6cec8c017c9e))
* release Python SDK v0.3.6 with hosted engine integration ([d3400a4](https://github.com/lelu-ai/lelu/commit/d3400a46f54982ce46197c60782413e1044a220a))
* release TypeScript SDK v0.2.7 with hosted engine integration ([2c84a4b](https://github.com/lelu-ai/lelu/commit/2c84a4b16ebbdc4c0f7f03ee50cd438ca1a1fd4d))
* rename to prizm-engine and overhaul UI landing page ([2b1c0ad](https://github.com/lelu-ai/lelu/commit/2b1c0ad6ed65c1c9be979c2122c297ba8d3db6b2))


### Bug Fixes

* add missing sdk/python/README.md required by hatchling ([46d8fc6](https://github.com/lelu-ai/lelu/commit/46d8fc6296b341283923d0e7e2e7bebe05a0f435))
* Add type annotations to LocalStorage context manager methods ([1111a6a](https://github.com/lelu-ai/lelu/commit/1111a6a83b050b575eb765c78bcd360b9ec599c6))
* add type cast for Depends return in fastapi.py ([4065325](https://github.com/lelu-ai/lelu/commit/40653254b199894adea41c12792eed0a3986f5d7))
* Improve error handling in Python SDK CLI ([05e32a7](https://github.com/lelu-ai/lelu/commit/05e32a7702167d27a11db4e2b62750f2cc0162ac))
* invalid f-string conversion chain in AuthEngineError.__repr__ ([12ec3ec](https://github.com/lelu-ai/lelu/commit/12ec3ec584e6fb94d38b77086804d8bb241eabb9))
* resolve final mypy errors in Python SDK observability ([0f7667a](https://github.com/lelu-ai/lelu/commit/0f7667a04ec35cb4e09d96e7ce3e648b3a32de38))
* resolve mypy redefinition errors in Python SDK observability ([e958131](https://github.com/lelu-ai/lelu/commit/e958131074a13007c43273ea12e5b1a5090bf3a6))
* resolve mypy type checking errors in Python SDK observability ([c54a5c3](https://github.com/lelu-ai/lelu/commit/c54a5c36f80c4ddf96a3cce253760c2db39a4a65))
* resolve mypy type errors in Python SDK ([4f853fa](https://github.com/lelu-ai/lelu/commit/4f853fadae9efb03f0383a8037f671cf0a024e6c))
* Resolve mypy type errors in Python SDK Phase 2 methods ([910655e](https://github.com/lelu-ai/lelu/commit/910655e4614ebdde4641e63886f87d57175512b1))


### Documentation

* Add Docker deployment documentation and update SDK packages ([15d4d15](https://github.com/lelu-ai/lelu/commit/15d4d15db185b2c4a1a97eb5ea6f330a1f40343c))
* add Docker Hub engine usage across READMEs ([f96f7dc](https://github.com/lelu-ai/lelu/commit/f96f7dc93139e720ad00fbbc2d18889eb0cd7473))
* migrate repository references to lelu-ai ([8b30620](https://github.com/lelu-ai/lelu/commit/8b30620c40828d30a613436530ddcf5db790f6b9))


### Miscellaneous

* **branding:** finalize Prism naming across repo ([d33b53c](https://github.com/lelu-ai/lelu/commit/d33b53ca1a5f2d9da5d82b3113f4e927f3168d1f))
* bump Python SDK to v0.2.0 for PyPI publication ([ce4a35b](https://github.com/lelu-ai/lelu/commit/ce4a35b52f85ddabab595a9a5db8ecf2cbb07726))
* bump version to 0.0.5 and add author information ([0ffd3d8](https://github.com/lelu-ai/lelu/commit/0ffd3d8aaa22bb4fa035f760aa9fb52a2a333f8c))
* release main ([f1dfe74](https://github.com/lelu-ai/lelu/commit/f1dfe74e67498f3e1a05d8a56cfc02cc55c073db))
* release main ([9fb4e99](https://github.com/lelu-ai/lelu/commit/9fb4e992820e42a821988f2c7735d339cadfde48))
* rename Python package to prism-engine ([1974a0f](https://github.com/lelu-ai/lelu/commit/1974a0f59d4c796de4fed6a115cfff85d7802568))
* **sdk:** rename npm package references to prism ([5313e3c](https://github.com/lelu-ai/lelu/commit/5313e3c6bca43713848b1ac455f1da16fc19491a))
* Update SDK exports and engine dependencies ([9a03031](https://github.com/lelu-ai/lelu/commit/9a030315168a6d74fa4c1a0496cf45990987462a))

## [0.1.1](https://github.com/lelu-ai/lelu/compare/python-sdk-v0.1.0...python-sdk-v0.1.1) (2026-03-08)


### Features

* add extensibility for OSS contributors and YC alignment ([daa7177](https://github.com/lelu-ai/lelu/commit/daa7177fe67a26ff26e0c16e0981af14a84c407e))
* Phase 1 — Go engine, Docker, CI/CD, TS + Python SDKs ([575a5d7](https://github.com/lelu-ai/lelu/commit/575a5d799a712b7dda8f5d2f42a5ec1c4e11489f))
* Phase 2 — Confidence Layer (queue, SecureTool, LangGraph, S3 sink) ([bb271e4](https://github.com/lelu-ai/lelu/commit/bb271e40ab3fc59dab18d5f4f755dc1045c5d8a0))
* Phase 3 — Cloud Platform, Trace Explorer UI, React hook, FastAPI/Express middleware ([b3ea833](https://github.com/lelu-ai/lelu/commit/b3ea83306d2744f7fdeed00d70d7c75966ff6160))
* Phase 4 scaffold — Helm chart, Rego compatibility, AutoGPT plugin, OIDC SSO, OSS release workflow ([14a9ebd](https://github.com/lelu-ai/lelu/commit/14a9ebd277f439c954b37de5d4cc6cec8c017c9e))
* rename to prizm-engine and overhaul UI landing page ([2b1c0ad](https://github.com/lelu-ai/lelu/commit/2b1c0ad6ed65c1c9be979c2122c297ba8d3db6b2))


### Bug Fixes

* add missing sdk/python/README.md required by hatchling ([46d8fc6](https://github.com/lelu-ai/lelu/commit/46d8fc6296b341283923d0e7e2e7bebe05a0f435))
* add type cast for Depends return in fastapi.py ([4065325](https://github.com/lelu-ai/lelu/commit/40653254b199894adea41c12792eed0a3986f5d7))
* invalid f-string conversion chain in AuthEngineError.__repr__ ([12ec3ec](https://github.com/lelu-ai/lelu/commit/12ec3ec584e6fb94d38b77086804d8bb241eabb9))
* resolve mypy type errors in Python SDK ([4f853fa](https://github.com/lelu-ai/lelu/commit/4f853fadae9efb03f0383a8037f671cf0a024e6c))


### Documentation

* migrate repository references to lelu-ai ([8b30620](https://github.com/lelu-ai/lelu/commit/8b30620c40828d30a613436530ddcf5db790f6b9))


### Miscellaneous

* **branding:** finalize Prism naming across repo ([d33b53c](https://github.com/lelu-ai/lelu/commit/d33b53ca1a5f2d9da5d82b3113f4e927f3168d1f))
* rename Python package to prism-engine ([1974a0f](https://github.com/lelu-ai/lelu/commit/1974a0f59d4c796de4fed6a115cfff85d7802568))
* **sdk:** rename npm package references to prism ([5313e3c](https://github.com/lelu-ai/lelu/commit/5313e3c6bca43713848b1ac455f1da16fc19491a))
