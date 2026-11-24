# Lelu for OpenClaw

Stops your OpenClaw agent from doing something you can't undo.

`lelu-openclaw` checks every tool call before it runs:

- **Blocks** calls that are almost never what you meant, like `rm -rf ~`, formatting a disk, or a fork bomb.
- **Asks you first** before risky ones, like `sudo`, `git push --force`, dropping a database table, sending email, publishing a package, piping a downloaded script into `bash`, or editing `~/.ssh`. OpenClaw pauses the run and you approve or deny it in chat (or with `/approve`).
- **Lets everything else through** with no delay and no prompts.

It runs entirely inside OpenClaw. It needs no account and no extra download, and it makes no network calls.

## Install

```bash
openclaw plugins install lelu-openclaw
openclaw plugins enable lelu
```

Check it loaded:

```bash
openclaw plugins inspect lelu --runtime --json
```

Then ask your agent to run `sudo ls`. OpenClaw should ask you to approve it first.

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

The command checks cover `exec`, `process`, `terminal` and `code_execution`. The file checks cover `write`, `edit` and `apply_patch`.

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
