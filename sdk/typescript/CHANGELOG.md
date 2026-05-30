# Changelog

## [0.0.18] (2026-05-30)

### Engine Upgrades

* **injection detector**: 5-layer pipeline (exact → homoglyph → fuzzy → structural → entropy), 45 patterns, unicode normalization, Levenshtein fuzzy match — detection rate raised from ~60% to ~85%+
* **anomaly detector**: replaced z-score baseline with real Extended Isolation Forest in pure Go — random hyperplane splits, multivariate interaction scoring, automatic fallback until forest is trained
* **policy evaluator**: wildcard pattern matching — `*`, `read_*`, `*_prod`, `*_prod_*` all supported; deny-first evaluation with matched pattern reported in audit reason
* **confidence escalator**: isotonic regression calibration via Pool Adjacent Violators (PAV) algorithm; dynamic threshold maximises TPR at FPR ≤ 5%; smooth ≤0.1 threshold shifts per refit cycle

### Bug Fixes

* `compute` decision now correctly included in AuditEvent decision union on the platform
* Audit log and policy editor aligned on all four decisions: `allow`, `deny`, `human_review`, `compute`

## [0.2.7](https://github.com/lelu-auth/lelu/compare/typescript-sdk-v0.2.6...typescript-sdk-v0.2.7) (2026-03-30)


### Features

* add 'lelu studio' command for visual UI management ([481e761](https://github.com/lelu-auth/lelu/commit/481e76171969c5dd41de80ce8d722cf831725127))
* Add anonymous rate limiting, dashboard, and API key management ([b8f24ad](https://github.com/lelu-auth/lelu/commit/b8f24ad55b5f72b3daee88bb18341635036b7fc3))
* Add built-in CLI audit-log command to all SDKs ([0943686](https://github.com/lelu-auth/lelu/commit/094368663337c0f6844b8b159aabfe53ebe79ccf))
* Add comprehensive CLI functionality to all SDKs ([61f292b](https://github.com/lelu-auth/lelu/commit/61f292bd35eb806d3812bb8e593ddebb3dac8db4))
* add HITL UI, Semantic Policy Generator, and Agent Reputation Dashboard ([a5586d4](https://github.com/lelu-auth/lelu/commit/a5586d4c8b709fc611404086d22045c4b7f9d9e7))
* Add SQLite local storage for all SDKs ([e38a67a](https://github.com/lelu-auth/lelu/commit/e38a67afd4e32c8b3b2966e378e918773f404ee3))
* Complete Phase 2 Behavioral Analytics SDK Updates ([0692d0d](https://github.com/lelu-auth/lelu/commit/0692d0dd221fc29c23abdb25f71019e8676f86aa))
* enhance React UI components with better styling and features ([84d7be0](https://github.com/lelu-auth/lelu/commit/84d7be0fd453ab2e2a2e8c6e805e07a7a1ccd6c0))
* implement multi-tenancy and fix SDK compilation ([bdd1e14](https://github.com/lelu-auth/lelu/commit/bdd1e140f5cff660a0cb22a3472307453669822f))
* implement Phase 1 Enhanced Observability & Telemetry for AI Agents ([c3a80f7](https://github.com/lelu-auth/lelu/commit/c3a80f707052e1958021a89333fc54f416bb079a))
* implement Phase 2 behavioral analytics across all SDKs ([c07a71f](https://github.com/lelu-auth/lelu/commit/c07a71f3966b608c6e640f1082b596baec69cb84))
* implement Prisma-like simple flow for lelu studio ([98b1945](https://github.com/lelu-auth/lelu/commit/98b1945b793eb893fd146c5d09b0e5447f07e377))
* implement production readiness features (API Key, Prometheus Metrics, Redis Queue) ([3cd2be0](https://github.com/lelu-auth/lelu/commit/3cd2be03d459c3c1abbfb5417c918e54b4f48096))
* Phase 1 — Go engine, Docker, CI/CD, TS + Python SDKs ([575a5d7](https://github.com/lelu-auth/lelu/commit/575a5d799a712b7dda8f5d2f42a5ec1c4e11489f))
* Phase 2 — Confidence Layer (queue, SecureTool, LangGraph, S3 sink) ([bb271e4](https://github.com/lelu-auth/lelu/commit/bb271e40ab3fc59dab18d5f4f755dc1045c5d8a0))
* Phase 3 — Cloud Platform, Trace Explorer UI, React hook, FastAPI/Express middleware ([b3ea833](https://github.com/lelu-auth/lelu/commit/b3ea83306d2744f7fdeed00d70d7c75966ff6160))
* release TypeScript SDK v0.2.7 with hosted engine integration ([2c84a4b](https://github.com/lelu-auth/lelu/commit/2c84a4b16ebbdc4c0f7f03ee50cd438ca1a1fd4d))
* rename to prizm-engine and overhaul UI landing page ([2b1c0ad](https://github.com/lelu-auth/lelu/commit/2b1c0ad6ed65c1c9be979c2122c297ba8d3db6b2))
* **ts-sdk:** add dashboard bootstrap CLI command ([7f93e69](https://github.com/lelu-auth/lelu/commit/7f93e69d75266975c18399e7d861f0cf8138568a))


### Bug Fixes

* add package-lock.json for npm ci cache in CI ([7228444](https://github.com/lelu-auth/lelu/commit/7228444a5c5e8513ab159e4495d462ccd100e749))
* Bump TypeScript SDK to v0.1.10 and deprecate v0.1.9 ([b0161a5](https://github.com/lelu-auth/lelu/commit/b0161a5fd90735db47379f18f279f7e700b54e94))
* exactOptionalPropertyTypes errors in TS SDK (apiKey, downgradedScope) ([c9639fe](https://github.com/lelu-auth/lelu/commit/c9639fec25059166eb505377500b392f474ae290))
* remove duplicate LeluClient identifiers in TypeScript SDK ([6583a7d](https://github.com/lelu-auth/lelu/commit/6583a7d8943fd2ad1f989350ec24e7b2640d3ed4))
* reorder exports so types comes first in TS SDK ([ef43488](https://github.com/lelu-auth/lelu/commit/ef43488f6740d7b8fd86d7401839d2239eb097c9))
* resolve TypeScript type checking errors in observability ([6206a58](https://github.com/lelu-auth/lelu/commit/6206a5890e17141bd8e9f360893f477cc199e26f))


### Documentation

* Add Docker deployment documentation and update SDK packages ([15d4d15](https://github.com/lelu-auth/lelu/commit/15d4d15db185b2c4a1a97eb5ea6f330a1f40343c))
* add Docker Hub engine usage across READMEs ([f96f7dc](https://github.com/lelu-auth/lelu/commit/f96f7dc93139e720ad00fbbc2d18889eb0cd7473))
* add POSTMAN.md testing guide + fix SecureTool test imports ([14b050c](https://github.com/lelu-auth/lelu/commit/14b050c1150a2fc5e431b5d140bbafe8b32d9ded))
* migrate repository references to lelu-auth ([8b30620](https://github.com/lelu-auth/lelu/commit/8b30620c40828d30a613436530ddcf5db790f6b9))
* **sdk:** add logo and bump @lelu-auth/lelu to 0.1.2 ([5c78d30](https://github.com/lelu-auth/lelu/commit/5c78d3015180b77a75651729dc8310d04f62c8cf))
* update license copyright email ([80dffb6](https://github.com/lelu-auth/lelu/commit/80dffb60105b644caf2d8da9d0a4cd6e7ff61704))


### Miscellaneous

* **branding:** finalize Prism naming across repo ([d33b53c](https://github.com/lelu-auth/lelu/commit/d33b53ca1a5f2d9da5d82b3113f4e927f3168d1f))
* bump TypeScript SDK to v0.1.5 and publish with audit-log CLI ([8d037fa](https://github.com/lelu-auth/lelu/commit/8d037fabad7ae4f1b5e5bf4d90960642292db65c))
* bump version to 0.0.5 and add author information ([0ffd3d8](https://github.com/lelu-auth/lelu/commit/0ffd3d8aaa22bb4fa035f760aa9fb52a2a333f8c))
* release main ([f1dfe74](https://github.com/lelu-auth/lelu/commit/f1dfe74e67498f3e1a05d8a56cfc02cc55c073db))
* release main ([9fb4e99](https://github.com/lelu-auth/lelu/commit/9fb4e992820e42a821988f2c7735d339cadfde48))
* **sdk:** rename npm package references to prism ([5313e3c](https://github.com/lelu-auth/lelu/commit/5313e3c6bca43713848b1ac455f1da16fc19491a))
* **sdk:** update npm logo/docs links and bump to 0.1.3 ([c6d56fc](https://github.com/lelu-auth/lelu/commit/c6d56fca02ed0a62110dccac169c4ae2b7ffe3c6))
* update homepage to Vercel docs site and add gitignore for UI ([d4c51ea](https://github.com/lelu-auth/lelu/commit/d4c51ea931a159bc6b7e49abd17ecdf6475af01e))
* Update package-lock.json for TypeScript SDK ([a24f1eb](https://github.com/lelu-auth/lelu/commit/a24f1eb96fd8f5d6c62ef07bb93b7a61312a9932))
* Update SDK exports and engine dependencies ([9a03031](https://github.com/lelu-auth/lelu/commit/9a030315168a6d74fa4c1a0496cf45990987462a))

## [0.1.1](https://github.com/lelu-auth/lelu/compare/typescript-sdk-v0.1.0...typescript-sdk-v0.1.1) (2026-03-08)


### Features

* add HITL UI, Semantic Policy Generator, and Agent Reputation Dashboard ([a5586d4](https://github.com/lelu-auth/lelu/commit/a5586d4c8b709fc611404086d22045c4b7f9d9e7))
* enhance React UI components with better styling and features ([84d7be0](https://github.com/lelu-auth/lelu/commit/84d7be0fd453ab2e2a2e8c6e805e07a7a1ccd6c0))
* implement multi-tenancy and fix SDK compilation ([bdd1e14](https://github.com/lelu-auth/lelu/commit/bdd1e140f5cff660a0cb22a3472307453669822f))
* implement production readiness features (API Key, Prometheus Metrics, Redis Queue) ([3cd2be0](https://github.com/lelu-auth/lelu/commit/3cd2be03d459c3c1abbfb5417c918e54b4f48096))
* Phase 1 — Go engine, Docker, CI/CD, TS + Python SDKs ([575a5d7](https://github.com/lelu-auth/lelu/commit/575a5d799a712b7dda8f5d2f42a5ec1c4e11489f))
* Phase 2 — Confidence Layer (queue, SecureTool, LangGraph, S3 sink) ([bb271e4](https://github.com/lelu-auth/lelu/commit/bb271e40ab3fc59dab18d5f4f755dc1045c5d8a0))
* Phase 3 — Cloud Platform, Trace Explorer UI, React hook, FastAPI/Express middleware ([b3ea833](https://github.com/lelu-auth/lelu/commit/b3ea83306d2744f7fdeed00d70d7c75966ff6160))
* rename to prizm-engine and overhaul UI landing page ([2b1c0ad](https://github.com/lelu-auth/lelu/commit/2b1c0ad6ed65c1c9be979c2122c297ba8d3db6b2))


### Bug Fixes

* add package-lock.json for npm ci cache in CI ([7228444](https://github.com/lelu-auth/lelu/commit/7228444a5c5e8513ab159e4495d462ccd100e749))
* exactOptionalPropertyTypes errors in TS SDK (apiKey, downgradedScope) ([c9639fe](https://github.com/lelu-auth/lelu/commit/c9639fec25059166eb505377500b392f474ae290))
* remove duplicate LeluClient identifiers in TypeScript SDK ([6583a7d](https://github.com/lelu-auth/lelu/commit/6583a7d8943fd2ad1f989350ec24e7b2640d3ed4))
* reorder exports so types comes first in TS SDK ([ef43488](https://github.com/lelu-auth/lelu/commit/ef43488f6740d7b8fd86d7401839d2239eb097c9))


### Documentation

* add POSTMAN.md testing guide + fix SecureTool test imports ([14b050c](https://github.com/lelu-auth/lelu/commit/14b050c1150a2fc5e431b5d140bbafe8b32d9ded))
* migrate repository references to lelu-auth ([8b30620](https://github.com/lelu-auth/lelu/commit/8b30620c40828d30a613436530ddcf5db790f6b9))
* update license copyright email ([80dffb6](https://github.com/lelu-auth/lelu/commit/80dffb60105b644caf2d8da9d0a4cd6e7ff61704))


### Miscellaneous

* **branding:** finalize Prism naming across repo ([d33b53c](https://github.com/lelu-auth/lelu/commit/d33b53ca1a5f2d9da5d82b3113f4e927f3168d1f))
* **sdk:** rename npm package references to prism ([5313e3c](https://github.com/lelu-auth/lelu/commit/5313e3c6bca43713848b1ac455f1da16fc19491a))
