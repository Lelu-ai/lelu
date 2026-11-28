# Changelog

## [0.0.36](https://github.com/Lelu-ai/lelu/releases/tag/lelu-mcp-v0.0.36) (2026-11-22)


### Bug Fixes

* **Install works again and keeps working.** `npx lelu-mcp start` downloads the newest engine release that actually has a binary for your platform and a `SHA256SUMS.txt`, instead of failing on a release whose files are missing (engine-v0.3.0 was published empty). ([cf3faf7](https://github.com/Lelu-ai/lelu/commit/cf3faf7fb5d4fd92dcfb7181f36a3bb60b6e1134))
* **Resumable, patient download.** A dropped or stalled connection resumes where it stopped (HTTP Range), with progress shown in 10% steps and retries that ride out about 1.5 minutes of outage. The binary is still checksum-verified before it is written. ([cf3faf7](https://github.com/Lelu-ai/lelu/commit/cf3faf7fb5d4fd92dcfb7181f36a3bb60b6e1134), [af1e26b](https://github.com/Lelu-ai/lelu/commit/af1e26b59a6c0700a9007135c73a399fb441aae2))
* **No more silent failure.** If no engine can be started and none is running on `localhost:8082`, lelu-mcp exits with the reason instead of serving tools with nothing behind them. ([cf3faf7](https://github.com/Lelu-ai/lelu/commit/cf3faf7fb5d4fd92dcfb7181f36a3bb60b6e1134))
* **`lelu_get_review` takes `review_id`**, the same name `lelu_agent_authorize` returns and its own description uses. It previously required `reviewId`, so passing the value straight back failed. ([af1e26b](https://github.com/Lelu-ai/lelu/commit/af1e26b59a6c0700a9007135c73a399fb441aae2))
* **Dependencies:** zod 4.6.7 and @modelcontextprotocol/sdk 1.32.2. `npm audit --omit=dev` is clean. ([af1e26b](https://github.com/Lelu-ai/lelu/commit/af1e26b59a6c0700a9007135c73a399fb441aae2))

From this release on, lelu-mcp is released and published automatically with release-please.
