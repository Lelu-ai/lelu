# Changelog

## [0.1.1](https://github.com/lelu-auth/lelu/compare/engine-v0.1.0...engine-v0.1.1) (2026-03-08)


### Features

* add extensibility for OSS contributors and YC alignment ([daa7177](https://github.com/lelu-auth/lelu/commit/daa7177fe67a26ff26e0c16e0981af14a84c407e))
* implement multi-tenancy and fix SDK compilation ([bdd1e14](https://github.com/lelu-auth/lelu/commit/bdd1e140f5cff660a0cb22a3472307453669822f))
* implement production readiness features (API Key, Prometheus Metrics, Redis Queue) ([3cd2be0](https://github.com/lelu-auth/lelu/commit/3cd2be03d459c3c1abbfb5417c918e54b4f48096))
* Phase 1 — Go engine, Docker, CI/CD, TS + Python SDKs ([575a5d7](https://github.com/lelu-auth/lelu/commit/575a5d799a712b7dda8f5d2f42a5ec1c4e11489f))
* Phase 2 — Confidence Layer (queue, SecureTool, LangGraph, S3 sink) ([bb271e4](https://github.com/lelu-auth/lelu/commit/bb271e40ab3fc59dab18d5f4f755dc1045c5d8a0))
* Phase 4 scaffold — Helm chart, Rego compatibility, AutoGPT plugin, OIDC SSO, OSS release workflow ([14a9ebd](https://github.com/lelu-auth/lelu/commit/14a9ebd277f439c954b37de5d4cc6cec8c017c9e))
* rename to prizm-engine and overhaul UI landing page ([2b1c0ad](https://github.com/lelu-auth/lelu/commit/2b1c0ad6ed65c1c9be979c2122c297ba8d3db6b2))


### Bug Fixes

* add go.sum (generated via go mod tidy) ([451aa16](https://github.com/lelu-auth/lelu/commit/451aa164784f709563c678e0a2d9994162a0ea66))
* add GOPROXY + go.sum copy to Dockerfiles; use postgres:15 (locally cached) ([6e3c8ea](https://github.com/lelu-auth/lelu/commit/6e3c8eaf5e2cbe04725dd1383d2f10add0a5dec0))
* add missing opa dependency to engine go.mod ([119b05d](https://github.com/lelu-auth/lelu/commit/119b05d337684fbec92d9f41ab2eac66cddd7bb9))
* adjust confidence signal for read-only test to be more conservative ([7af8160](https://github.com/lelu-auth/lelu/commit/7af81605f80e9f11a8e70a27f37232e1c40d39cb))
* align map keys and reorder imports in server.go ([99c3af1](https://github.com/lelu-auth/lelu/commit/99c3af14f86a60bf079a45e6085d66b0ae5aaa59))
* align struct field types in simulatorReplayRequest ([6ec68d0](https://github.com/lelu-auth/lelu/commit/6ec68d08b9ff46d9f5b8a55b23d06923767dcfe0))
* align struct field types in simulatorTraceItem ([716de60](https://github.com/lelu-auth/lelu/commit/716de60fc29b98305b1413ba3e71a0036fe94f54))
* align struct fields and imports formatting ([3bd05a5](https://github.com/lelu-auth/lelu/commit/3bd05a5161ea02ede7ba1c2981040ff49d56d863))
* bump golang-jwt/jwt/v5 to v5.2.2 (CVE-2025-30204) ([a9f3c4c](https://github.com/lelu-auth/lelu/commit/a9f3c4c469630795e8c7b5755a2a8981ab7d9527))
* change GOPROXY to proxy.golang.org to fix build errors ([86040b3](https://github.com/lelu-auth/lelu/commit/86040b3fdef696048f245e765f6c87eb374ed2d7))
* correct confidence signal in TestAgentAuthorize_ReadOnlyIsExecutableMode ([ea628e8](https://github.com/lelu-auth/lelu/commit/ea628e801051839741729dd74230e324e56d3312))
* Dockerfile + server build fixes ([94b8bcd](https://github.com/lelu-auth/lelu/commit/94b8bcdd86dd74185f10f820f9d1cd73b585afac))
* final gofmt/goimports formatting fixes ([747b562](https://github.com/lelu-auth/lelu/commit/747b5625c946f81ec0f9102f31ba8022dd336f79))
* format test files with goimports ([e486a14](https://github.com/lelu-auth/lelu/commit/e486a14b60a3cddee30392d08ba24840509946c5))
* gofmt alignment in tokens.go and main.go ([c460cc4](https://github.com/lelu-auth/lelu/commit/c460cc49e19c584452dd00ded432cbdb32654c84))
* remove trailing whitespace and fix import order ([14d90a0](https://github.com/lelu-auth/lelu/commit/14d90a0361ede9aba96d33e39a3d22b9310cae7f))
* remove trailing whitespace in logging function ([ff08061](https://github.com/lelu-auth/lelu/commit/ff08061cf064af0f13a37ca689f56b6dfec22820))
* resolve golangci-lint errors ([d5ea924](https://github.com/lelu-auth/lelu/commit/d5ea924bf025e04ea4a288c983c7dbf2bfa45c6a))
* resolve golangci-lint errors (errcheck, revive, gofmt, gosimple) ([f245a60](https://github.com/lelu-auth/lelu/commit/f245a60b999409a9b4a4a9b2db09ce72d405cede))
* resolve remaining gofmt/goimports issues ([f11390b](https://github.com/lelu-auth/lelu/commit/f11390ba1dc385ace0105e9dc369d1b9f32c5c89))
* update OPA import to use v1 package to resolve deprecation warning ([71b2825](https://github.com/lelu-auth/lelu/commit/71b2825012d2dbb587fa75c19d279d4dee35b843))
* use even lower confidence (0.10) for read-only test ([6a36efe](https://github.com/lelu-auth/lelu/commit/6a36efe920f0a72b0c74513556f63bb1609ba95a))
* use policy-based downgrade instead of risk-based for read-only test ([809dbdb](https://github.com/lelu-auth/lelu/commit/809dbdbd477bc01d25503f699b3e55be77e294e8))


### Miscellaneous

* **branding:** finalize Prism naming across repo ([d33b53c](https://github.com/lelu-auth/lelu/commit/d33b53ca1a5f2d9da5d82b3113f4e927f3168d1f))
