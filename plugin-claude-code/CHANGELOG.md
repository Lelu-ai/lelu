# Changelog

## [0.3.0](https://github.com/Lelu-ai/lelu/compare/plugin-claude-code-v0.2.1...plugin-claude-code-v0.3.0) (2026-11-27)


### Features

* **plugin:** 4x smaller download, instant session start, fewer prompts ([71c203e](https://github.com/Lelu-ai/lelu/commit/71c203efa55df8270c004be5851a45f787df5417))
  * Hook and daemon are one binary (`cmd/lelu`), published gzipped: about 1.5 MB per platform instead of two binaries totalling 6.2 MB. The separate `lelu-daemon-*` and `lelu-hook-*` binaries are still published for `install.sh`.
  * Session start no longer waits for the download, which runs in the background. In shadow mode tool calls pass through until it finishes; in enforce mode they wait for it or ask, as before.
  * New users see a one-time welcome that explains shadow mode and the commands.
  * Commands are renamed to `/lelu:status`, `/lelu:enforce` and `/lelu:shadow` (were `/lelu:lelu-status` and so on). `/lelu:status` leads with what Lelu caught and no longer reads the whole ledger.
  * In enforce mode, `WebFetch` to a domain already allowed in Claude Code's settings no longer asks, and more of Claude Code's own tools are on the allow list.

## [0.2.1](https://github.com/Lelu-ai/lelu/compare/plugin-claude-code-v0.2.0...plugin-claude-code-v0.2.1) (2026-11-27)


### Bug Fixes

* **plugin:** protect Lelu's own files and make the first download reliable ([bb2804d](https://github.com/Lelu-ai/lelu/commit/bb2804db73877de66c303aa4f0edae81dcacb191))
  * Changes to Lelu's data directory (including a custom `LELU_DATA_DIR`), `~/.claude/plugins/` and `.claude/settings*.json`, through a file tool or a shell command, are routed to ask, so an agent cannot switch Lelu off by editing its mode file, policy or binaries ([#118](https://github.com/Lelu-ai/lelu/issues/118)). Reads stay quiet.
  * The binary download has no overall time limit: curl gives up only when the transfer stalls below 1 KB/s for a minute, and curl and wget both retry. The download lock records its process ID and is cleared at once when that process is gone. The SessionStart timeout is 10 minutes.

## [0.2.0](https://github.com/Lelu-ai/lelu/compare/plugin-claude-code-v0.1.0...plugin-claude-code-v0.2.0) (2026-11-26)


### Bug Fixes

* **plugin:** work after a marketplace install, fail closed, hook every tool ([b92c0a8](https://github.com/Lelu-ai/lelu/commit/b92c0a82f2a4dcf54a64095fbce61354258e34cf))
  * A marketplace install had no hook binary, so every tool call went unchecked. `hooks/lelu-hook.sh` now downloads `lelu-hook` and `lelu-daemon` for this OS and CPU on first use, checks them against the release's `SHA256SUMS.txt`, and installs them under `~/.lelu/claude-plugin/bin/<version>`. A SessionStart hook does this before the first tool call.
  * Fail closed in enforce mode: when Lelu cannot check an action, the call is routed to ask ([#144](https://github.com/Lelu-ai/lelu/issues/144)). `LELU_FAIL_CLOSED=1` or `0` overrides.
  * Every tool is hooked (matcher `*`) ([#145](https://github.com/Lelu-ai/lelu/issues/145)): `MultiEdit` and `NotebookEdit` get the protected-path rule, reading a credential, key or env file asks, `WebFetch` asks unless the host is allowed, and a tool with no rule that is not on `tools.allow` asks.
  * The daemon also loads `policy.local.json` from the data directory, so user rules survive plugin updates.
* **plugin:** handle process substitution and recover from daemon panics ([6860e0d](https://github.com/Lelu-ai/lelu/commit/6860e0d1c4d14668a3d3d76bd52f4dd4ae89ead5))
* **plugin:** never emit an explicit allow; close detection gaps ([72c4d6d](https://github.com/Lelu-ai/lelu/commit/72c4d6de799c802a19a6f9589ed566352b9ec4f2))
* **plugin:** harden installer downloads and daemon startup ([9e3bd44](https://github.com/Lelu-ai/lelu/commit/9e3bd449ffd37deb7264b32eb8fbc60d7fca4db9))
* **plugin:** unify Claude Code data directory handling ([0c77c22](https://github.com/Lelu-ai/lelu/commit/0c77c221f4cc994e9e26a48f1a1a6c94f7e15a74))

## [0.1.0](https://github.com/Lelu-ai/lelu/releases/tag/plugin-claude-code-v0.1.0) (2026-07-24)


### Features

* **plugin:** add Claude Code plugin — expansion-aware PreToolUse guardrail ([699b1d8](https://github.com/Lelu-ai/lelu/commit/699b1d8c2dcb38a108e6addb1c4c30e175cb90e4))
* **plugin:** add Harbor/Terminal-Bench agent ([ddfdb6f](https://github.com/Lelu-ai/lelu/commit/ddfdb6feefb86654a4ff2af8dcd1598c11729fbd))
* **plugin:** add hookify-vs-Lelu benchmark, generated from real code ([6a49730](https://github.com/Lelu-ai/lelu/commit/6a497305b2978e7798d2dbd8010c7232461a9dbd))
* **plugin:** add loop/retry-storm detection (Tier 2) ([f3ee3c9](https://github.com/Lelu-ai/lelu/commit/f3ee3c9631c7bcf3a8b0f7517ed2f448c542b648))
* **plugin:** add session wall-clock budget checking ([f15d701](https://github.com/Lelu-ai/lelu/commit/f15d701cd2ccf0721e3987a44394b5ad527aa692))
* **plugin:** close the no-Go-toolchain install gap, fix a .git/.github false positive ([88971d0](https://github.com/Lelu-ai/lelu/commit/88971d0a83d3e6852f9ea4c8ff540791f2ec95c8))
* **plugin:** import hookify rules — zero-edit migration path ([6a17aae](https://github.com/Lelu-ai/lelu/commit/6a17aae73a65da747af42f8b78f26dcc062c72ba))


### Bug Fixes

* **plugin:** self-start the daemon on crash, and stop nagging on benign `$(...)` ([7eb5df9](https://github.com/Lelu-ai/lelu/commit/7eb5df9101ab7a76b53b9b728fec62423ffb381a))
