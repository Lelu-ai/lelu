<p align="center">
  <img src="https://raw.githubusercontent.com/Lelu-ai/lelu/main/sdk/openclaw/assets/icon.png" width="96" alt="Lelu">
</p>

<h1 align="center">Lelu for OpenClaw</h1>

<p align="center">
  <b>Stops your OpenClaw agent from doing something you can't undo.</b><br>
  One install. No account, no API key, no network calls.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/lelu-openclaw"><img src="https://img.shields.io/npm/v/lelu-openclaw?color=7c3aed" alt="npm version"></a>
  <a href="https://github.com/Lelu-ai/lelu/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
</p>

Your agent runs shell commands and edits files on your machine. One bad step, from a confused model or a prompt-injected web page, can wipe a folder, force-push over your work, or send your SSH key somewhere. Lelu checks every tool call before it runs:

- 🛑 **Blocks** calls that are almost never what you meant: `rm -rf ~`, formatting a disk, a fork bomb.
- ✋ **Asks you first** before risky ones: `sudo`, `git push --force`, `DROP TABLE`, sending email, `npm publish`, `curl … | bash`, editing `~/.ssh`. OpenClaw pauses the run and you approve or deny it in chat.
- ✅ **Lets everything else through**, with no delay and no prompts.

## Install

```bash
openclaw plugins install lelu-openclaw
```

This installs it from [ClawHub](https://clawhub.ai), where it's scanned and listed (`openclaw plugins search lelu` finds it). The plugin is on as soon as it's installed, including in a Gateway that's already running. Check that it loaded:

```bash
openclaw plugins inspect lelu --runtime
```

You can also install it straight from npm with `openclaw plugins install npm:lelu-openclaw`. OpenClaw then warns that the package is outside ClawHub review and asks you to confirm; in a script, add `--force`.

## Try it

Ask your agent to run `sudo ls`. OpenClaw pauses and asks you:

> **Lelu: Runs a command as administrator (sudo)**
> exec: sudo ls
> Rule lelu.sudo. Approve only if you expected the agent to do this.

Now ask it to run `rm -rf ~`. It never runs, and the agent is told why:

> Blocked by Lelu (lelu.rm-home-or-root): Recursively deletes the whole disk or home folder. To allow it, add "lelu.rm-home-or-root" to disableRules in the lelu plugin config.

## What it checks

| Rule | What happens | Example |
|---|---|---|
| `lelu.rm-home-or-root` | Blocked | `rm -rf ~`, `sudo rm -rf /` |
| `lelu.disk-wipe` | Blocked | `mkfs.ext4 /dev/sda1`, `dd of=/dev/sda` |
| `lelu.fork-bomb` | Blocked | `:(){ :\|:& };:` |
| `lelu.chmod-root` | Blocked | `chmod -R 777 /` |
| `lelu.pipe-to-shell` | Asks you | `curl … \| bash` |
| `lelu.sudo` | Asks you | `sudo apt install …` |
| `lelu.rm-recursive` | Asks you | `rm -rf node_modules` |
| `lelu.power` | Asks you | `reboot`, `shutdown` |
| `lelu.git-destructive` | Asks you | `git push --force`, `git reset --hard` |
| `lelu.database-destructive` | Asks you | `DROP TABLE`, `DELETE FROM x;` with no `WHERE` |
| `lelu.publish` | Asks you | `npm publish`, `docker push` |
| `lelu.send-email` | Asks you | `mail`, `himalaya … send` |
| `lelu.payments` | Asks you | `stripe refunds create` |
| `lelu.secret-exfiltration` | Asks you | `curl -F key=@~/.ssh/id_ed25519 …` |
| `lelu.openclaw-config-shell` | Asks you | `openclaw plugins install …`, `clawhub install …` |
| `lelu.sensitive-file-write` | Asks you | Writing `~/.ssh/*`, `.env`, `~/.bashrc`, `/etc/*`, git hooks, `openclaw.json` |
| `lelu.plugin-changes` | Asks you | The agent installing or removing plugins |
| `lelu.gateway-changes` | Asks you | The agent changing or restarting the Gateway |

The command checks cover `exec`, `process`, `terminal`, `code_execution`, `bash`, `shell` and `gateway_process`. The file checks cover `write`, `edit` and `apply_patch`.

## Configure

Settings go in `openclaw.json` under `plugins.entries.lelu.config`:

```json5
{
  plugins: {
    entries: {
      lelu: {
        enabled: true,
        config: {
          // Turn off built-in rules you don't want.
          disableRules: ["lelu.rm-recursive"],
          // Add your own. `command` and `path` are case-insensitive regexes.
          rules: [
            {
              id: "no-prod-db",
              tools: ["exec"],
              verdict: "deny", // or "review" to ask you first
              reason: "Touches the production database",
              command: "prod-db\\.internal",
            },
          ],
          // How long an approval waits before it counts as denied (10–3600).
          approvalTimeoutSeconds: 120,
        },
      },
    },
  },
}
```

If a rule matches, a block beats a request for approval. A block message names the rule, so you know what to put in `disableRules`.

## What it is and isn't

Lelu looks for known dangerous patterns in what the agent is about to run. It's a safety net that catches the common, costly mistakes, including ones caused by prompt injection. It's **not a sandbox**. A command written to avoid the patterns can still get through. For untrusted work, run OpenClaw in its sandbox too.

If the plugin hits an error while checking a call, it blocks the call rather than letting it through.

## Coming next

- Connect to [Lelu Cloud](https://lelu-ai.com) or a self-hosted Lelu engine for team policies, Slack approvals and a signed, searchable audit log of every decision.

Issues and ideas: https://github.com/Lelu-ai/lelu/issues

MIT licensed.
