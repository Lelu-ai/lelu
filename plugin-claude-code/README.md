# Lelu — guardrails for Claude Code

Claude Code is fast, and sometimes it is fast at the wrong thing. Lelu checks every tool call before it runs and stops the ones you would never have approved:

- **Destructive commands**, including disguised ones: `rm -rf ~/`, `rm -rf $HOME`, `sudo rm -fr /`, reversed and long-form flags. Lelu expands the command the way the shell would, so it sees the real target, not the text. ([benchmark](benchmarks/report.md))
- **Risky git**: force-pushes ask you first.
- **Your secrets**: reading, searching or copying `~/.ssh`, `~/.aws/credentials`, `.env` and similar files asks you first, and editing protected files is blocked. Rules match whole file and folder names, so `app.environment.ts`, `docs/setup.ssh.md` and `.env.example` are left alone ([details](#which-paths-are-checked)).
- **Data leaving your machine**: `WebFetch` to a site you haven't approved asks you first, and so does piping a download straight into a shell (`curl … | sh`).
- **Runaway sessions**: the same action repeated in a loop, or a session running for hours, gets a check-in.
- **Switching Lelu off**: changes to Lelu's own files or Claude Code's settings ask you first, in shadow mode too.

It starts in **shadow mode**: it only records what it would have done, and Claude Code works exactly as before, except that changes to Lelu's own files still ask ([why](#lelu-protects-its-own-files)). Run `/lelu:status` to see what it caught, then `/lelu:enforce` when you want it to act. Lelu never answers "allow" itself, so Claude Code's own permission prompts and rules keep working as they do today.

## Install

Inside Claude Code:

```
/plugin marketplace add Lelu-ai/lelu
/plugin install lelu@lelu
```

That's all. No account and no cloud service: decisions are made and logged on your machine, in about 20 ms per tool call.

## Commands

| Command | What it does |
|---|---|
| `/lelu:status` | Current mode, what Lelu caught, and the latest catches |
| `/lelu:enforce` | Start blocking and asking (runs a fixed command that writes `enforce` to the mode file; you approve it) |
| `/lelu:shadow` | Back to record-only (writes `shadow` to the mode file; you approve it) |
| `/lelu <rule>` | Add a rule in plain English, e.g. `/lelu never touch the prod database`. Rules are saved in `policy.local.json` in the data directory, so plugin updates keep them. They add to the defaults; they can't remove a default rule. |

## What the plugin downloads

The checker is a compiled Go program, so it is not in the plugin folder. When a session starts, [`hooks/lelu-hook.sh`](hooks/lelu-hook.sh), a short shell script you can read, downloads one file for your OS and CPU (Linux or macOS, amd64 or arm64), **about 1.5 MB**, from this repo's `plugin-claude-code-v<version>` [release](https://github.com/lelu-ai/lelu/releases). It checks the file against that release's `SHA256SUMS.txt` and unpacks it into `~/.lelu/claude-plugin/bin/<version>/`.

- The download runs in the background, so your session starts straight away. In shadow mode, tool calls go through while it finishes; in enforce mode they wait for it.
- It connects only to `github.com` and `release-assets.githubusercontent.com`, over HTTPS, once per plugin version. Nothing is uploaded.
- The file is built from [`daemon/`](daemon) by [this workflow](../.github/workflows/plugin-claude-code-release.yml), which also publishes a build provenance attestation for each release file. The attestation covers the downloaded `.gz` file, not the unpacked `lelu`, so verify the `.gz` and check that it unpacks to the file you have (use your OS and CPU in the file name):

  ```bash
  gh release download plugin-claude-code-v<version> -R Lelu-ai/lelu -p 'lelu-linux-amd64.gz'
  gh attestation verify lelu-linux-amd64.gz -R Lelu-ai/lelu
  gzip -dc lelu-linux-amd64.gz | cmp - ~/.lelu/claude-plugin/bin/<version>/lelu && echo same
  ```

  The separate `lelu-daemon-<os>-<arch>` and `lelu-hook-<os>-<arch>` files on the release, which `install.sh` uses, are attested too and can be verified directly.
- If the download fails, it retries after 10 minutes. It needs `curl` or `wget`, `sha256sum` or `shasum`, and `gzip`.

The plugin stores its ledger, mode, socket, daemon log, your own rules (`policy.local.json`) and the downloaded checker in
`$HOME/.lelu/claude-plugin` by default. Set `LELU_DATA_DIR` to use another
directory. `LELU_HOME` is accepted as a compatibility alias when
`LELU_DATA_DIR` is not set.

## Developing the plugin

Build from source and load the plugin straight from your checkout, so nothing is downloaded:

```bash
git clone https://github.com/lelu-ai/lelu.git && cd lelu
./plugin-claude-code/install.sh        # builds hooks/lelu-hook and bin/lelu-daemon with Go, starts the daemon
claude --plugin-dir ./plugin-claude-code
```

When `hooks/lelu-hook` and `bin/lelu-daemon` exist inside the plugin folder, the launcher uses them instead of the release binaries.

## Which tools are checked

The hook runs before every tool call, not a fixed list:

| Tool | Rule |
|---|---|
| `Bash` | Expansion-aware command analysis (above) |
| `Edit`, `Write`, `MultiEdit`, `NotebookEdit` | Denied on a protected path; asks on Lelu's own files and Claude Code's settings ([below](#lelu-protects-its-own-files)) |
| `Read` | Asks before reading a credential, key or env file (`sensitive_paths`) |
| `Grep`, `Glob` | Ask when the folder or file searched (`path`), or the glob (Grep's `glob`, Glob's `pattern`), points at a credential, key or env file: for example a search of `~/.ssh` or `~/.aws`, or a glob such as `**/.env*`. A search with no such path or glob, such as `**/*.ts` in your project, is not checked further |
| `WebFetch` | Asks unless the host, or a parent domain of it, is in `tools.web_fetch_allowed_hosts`, or you have already allowed the domain in Claude Code (`WebFetch(domain:…)` in your user or project settings) |
| Tools in `tools.allow` | No check of their own: tools that only read or plan, and `Task`/`Agent`, whose sub-agents' tool calls come through this hook too |
| `mcp__*` | Allowed for now; checking MCP tool definitions is [#147](https://github.com/lelu-ai/lelu/issues/147) |
| Any other tool | Asks: a tool Lelu has no rule for, including one Claude Code adds later, is not waved through |

To trust another tool or host, add it to `policy.local.json` in the data directory, for example `{"tools": {"allow": ["MyTool"], "web_fetch_allowed_hosts": ["wiki.example.com"]}}`, and restart the daemon (`pkill -x lelu-daemon`).

The ledger line for each call records what was checked: `command` for `Bash`, `file_path` for the file tools, `url` for `WebFetch`, and `path` and `glob` for `Grep` and `Glob`.

## Which paths are checked

Path rules match whole file and folder names, never part of a name. The default rules in `policies/defaults.json`:

| List | What it matches | Effect |
|---|---|---|
| `protected_paths` | Files named `.env`, `.env.<anything>` (except `.env.example`, `.env.sample`, `.env.template` and `.env.dist`) and `.envrc`; anything in a folder named `.git` or `.ssh`; files whose name starts with `id_rsa` or `id_ed25519`; `.aws/credentials`. Also `$HOME` and `/` themselves | Editing one is denied; `rm -rf` of one is denied |
| `sensitive_paths` | The same env files, `.ssh`, `.gnupg`, keys (`id_rsa*`, `id_ed25519*`, `id_ecdsa*`), `.aws/credentials`, `.aws/config`, `.netrc`, `.git-credentials`, `.docker/config.json`, `.kube/config` | Reading, searching or copying one asks |
| `guarded_paths` | `~/.lelu` (and the data directory, wherever it is), `.claude/plugins`, `.claude/settings.json`, `.claude/settings.local.json` | Changing one asks ([below](#lelu-protects-its-own-files)) |

So `app.environment.ts`, `config.env.d.ts`, `docs/setup.ssh.md`, `.github/` and a project folder named `.lelu` are not matched. A rule is written as `{"name": ".env"}` (one name), `{"name": ".aws/credentials"}` (names in a row) or `{"name": "id_rsa*"}` (with a wildcard). Rules you add to `policy.local.json` can also use `{"contains": "text"}`, which matches the text anywhere in a path.

## When Lelu can't check an action

If the daemon can't be reached, the checker hasn't been downloaded yet, or the hook input can't be read, Lelu can't check the call. What happens depends on the mode:

- **Shadow mode:** the call goes to Claude Code's normal permission flow, as if Lelu weren't installed. While the checker is still downloading this happens quietly; a failed download is reported when the next session starts, and a daemon that can't be reached shows a warning on the call.
- **Enforce mode:** the call is routed to `ask`, so you approve it yourself. Once blocking is on, stopping the daemon doesn't get an action past Lelu.

Set `LELU_FAIL_CLOSED=1` to always ask, or `LELU_FAIL_CLOSED=0` to never ask, whatever the mode.

If the downloaded checker goes missing, the launcher downloads it again on the next tool call or session start. If that keeps failing, reinstall the plugin with `/plugin install lelu@lelu`. For a plugin built from a checkout, run `./plugin-claude-code/install.sh` again.

## The mode file

The mode lives in `mode` in the data directory. Lelu ignores case and whitespace in it: `enforce`, `Enforce` or `ENFORCE\n` all mean enforce, and `shadow` means shadow. A missing file means shadow, the default. Any other value, including an empty file, also means shadow, and Lelu says so: at the start of each session, in `/lelu:status`, and in `daemon.log`. Use `/lelu:enforce` and `/lelu:shadow` rather than editing the file by hand.

## Lelu protects its own files

An agent could try to switch Lelu off instead of getting past it: writing `shadow` to the mode file, editing `policy.local.json`, deleting the downloaded binaries, or changing Claude Code's settings to disable the plugin or its hooks. So any change to these, through `Edit`, `Write`, `MultiEdit`, `NotebookEdit` or a shell command, is routed to `ask`:

- Lelu's data directory (`~/.lelu/` in your home directory, or wherever `LELU_DATA_DIR` points; a `.lelu` folder in a project is not included)
- Claude Code's plugin folder (`~/.claude/plugins/`)
- Claude Code's settings files (`.claude/settings.json` and `.claude/settings.local.json`, in your home directory or a project)

This applies in shadow mode too, the one exception to shadow mode blocking nothing: a change made while Lelu only records would still be in place when you turn enforcement on, so it would switch Lelu off before it ever enforced.

Reading them is not affected, so `/lelu:status` and `cat` or `tail` of the ledger work as before. `/lelu:enforce`, `/lelu:shadow` and `/lelu` still work; you approve the change yourself. The list is `guarded_paths` in `policies/defaults.json`.

At the start of each session the plugin also checks for changes made outside Claude Code:

- its own `hooks.json`, `lelu-hook.sh` and `policies/defaults.json` must be unchanged since this version first ran; if they were edited, it warns you at every session start until you reinstall or accept the change;
- if the mode file or your `policy.local.json` changed since the last session, it tells you once, with the mode Lelu is now in. These also change when you run `/lelu:enforce`, `/lelu:shadow` or `/lelu`, so check the message against what you did.

## How it's built

A Go daemon (`daemon/`) behind a local unix socket — no CGO, no database server, an append-only JSONL ledger instead. `hooks/lelu-hook.sh` installs the binaries (see above) and runs `lelu-hook`, the thin adapter that handles every tool call; if the daemon is down it tries to self-start it first, and otherwise follows [When Lelu can't check an action](#when-lelu-cant-check-an-action). `install.sh` verifies downloaded binaries against the release's `SHA256SUMS.txt` and only reports success once the daemon's socket is up.

MIT, same license as the rest of this repo.
