# Changelog

## [0.0.38](https://github.com/Lelu-ai/lelu/compare/lelu-mcp-v0.0.37...lelu-mcp-v0.0.38) (2026-11-28)


### Miscellaneous

* **npm:** repository URLs that match npm provenance ([3334d88](https://github.com/Lelu-ai/lelu/commit/3334d88f09faf6b437b37495bdbfac61d3d19c75))
* **npm:** repository URLs that match npm provenance ([0fd12e1](https://github.com/Lelu-ai/lelu/commit/0fd12e17127a36b1bfa537439d9089430d7d4d67))

## [0.0.37](https://github.com/Lelu-ai/lelu/compare/lelu-mcp-v0.0.36...lelu-mcp-v0.0.37) (2026-11-28)


### Bug Fixes

* install.sh finds the engine release and verifies it; changelog cleanup ([b6bf7c6](https://github.com/Lelu-ai/lelu/commit/b6bf7c6a63eb8ddea8babc13d70223f64747ccf2))
* **mcp:** accept token_id in lelu_revoke_token ([1fadd05](https://github.com/Lelu-ai/lelu/commit/1fadd0569974c5a2e075ac8800b24ecd14352e79))
* **mcp:** exit instead of falling back to localhost:8082 ([43c1e60](https://github.com/Lelu-ai/lelu/commit/43c1e609dd8178117ae245338ec3fa91717add62))
* **mcp:** give the local engine its own signing and vault keys ([e690a6c](https://github.com/Lelu-ai/lelu/commit/e690a6ce0c01018e4cb2a577ac6f29d4ce772bdb))
* **mcp:** make add --cursor / --open-code print a working stdio config ([41f9a75](https://github.com/Lelu-ai/lelu/commit/41f9a759c9c67ec7e5a7e2445a42c4d3fdfb337e))
* **mcp:** shut down when the stdio client closes stdin ([febc4c7](https://github.com/Lelu-ai/lelu/commit/febc4c77194c9f790bc717578f2f80cdbc9efdd0))
* **mcp:** upgrade the cached engine and report which version runs ([34e79cc](https://github.com/Lelu-ai/lelu/commit/34e79cca7eeba1125a96a3ad59bb1b1df43c4809))
* **mcp:** upgrade the cached engine, own signing key, clean shutdown, working add config ([2da8cd4](https://github.com/Lelu-ai/lelu/commit/2da8cd434282efc8da453dccd8a828ef780b4740))


### Documentation

* **changelog:** add changelogs for lelu-mcp and the Claude Code plugin ([7cb92c8](https://github.com/Lelu-ai/lelu/commit/7cb92c805343a77af96cc59d7e357570b67d15e7))


### Miscellaneous

* release main ([7525ffc](https://github.com/Lelu-ai/lelu/commit/7525ffcd32533148cc80287067fb8ab069e87b6e))
* release main ([eb34e88](https://github.com/Lelu-ai/lelu/commit/eb34e88db06535f4d6ba4ded83e87913fe928e58))

## [0.0.36](https://github.com/Lelu-ai/lelu/releases/tag/lelu-mcp-v0.0.36) (2026-11-22)


### Bug Fixes

* **Install works again and keeps working.** `npx lelu-mcp start` downloads the newest engine release that actually has a binary for your platform and a `SHA256SUMS.txt`, instead of failing on a release whose files are missing (engine-v0.3.0 was published empty). ([cf3faf7](https://github.com/Lelu-ai/lelu/commit/cf3faf7fb5d4fd92dcfb7181f36a3bb60b6e1134))
* **Resumable, patient download.** A dropped or stalled connection resumes where it stopped (HTTP Range), with progress shown in 10% steps and retries that ride out about 1.5 minutes of outage. The binary is still checksum-verified before it is written. ([cf3faf7](https://github.com/Lelu-ai/lelu/commit/cf3faf7fb5d4fd92dcfb7181f36a3bb60b6e1134), [af1e26b](https://github.com/Lelu-ai/lelu/commit/af1e26b59a6c0700a9007135c73a399fb441aae2))
* **No more silent failure.** If no engine can be started and none is running on `localhost:8082`, lelu-mcp exits with the reason instead of serving tools with nothing behind them. ([cf3faf7](https://github.com/Lelu-ai/lelu/commit/cf3faf7fb5d4fd92dcfb7181f36a3bb60b6e1134))
* **`lelu_get_review` takes `review_id`**, the same name `lelu_agent_authorize` returns and its own description uses. It previously required `reviewId`, so passing the value straight back failed. ([af1e26b](https://github.com/Lelu-ai/lelu/commit/af1e26b59a6c0700a9007135c73a399fb441aae2))
* **Dependencies:** zod 4.6.7 and @modelcontextprotocol/sdk 1.32.2. `npm audit --omit=dev` is clean. ([af1e26b](https://github.com/Lelu-ai/lelu/commit/af1e26b59a6c0700a9007135c73a399fb441aae2))

From this release on, lelu-mcp is released and published automatically with release-please.
