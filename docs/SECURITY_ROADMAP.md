# Security roadmap

Lelu sits on the path between an AI agent and the actions it takes. A weakness
in Lelu weakens every agent that relies on it. This page sets out what has
been fixed, what is next and in what order, so that users can judge how far to
rely on Lelu today.

For the limits that apply right now, read
[What Lelu does not do](../README.md#what-lelu-does-not-do) and
[DEPLOYMENT_SECURITY.md](DEPLOYMENT_SECURITY.md). To report a vulnerability, see
[SECURITY.md](../SECURITY.md).

## Done: the 0.0.14 audit

An independent audit of version 0.0.14 produced 17 findings. **All 17 are
fixed and closed.** They include:

| Finding | Severity | Issue |
|---|---|---|
| `tenant_id` was attacker-controlled, so multi-tenancy was not enforced | High | [#25](https://github.com/Lelu-ai/lelu/issues/25) |
| Unbounded memory keyed on an attacker-controlled actor name | High | [#26](https://github.com/Lelu-ai/lelu/issues/26) |
| Thin test coverage on the core decision logic | High | [#28](https://github.com/Lelu-ai/lelu/issues/28) |
| Prompt-injection filter ignored arguments and scope | Medium | [#17](https://github.com/Lelu-ai/lelu/issues/17) |
| Dashboard middleware checked that a session cookie existed, not that it was valid | Medium | [#23](https://github.com/Lelu-ai/lelu/issues/23) |
| No server-side session revocation | Medium | [#24](https://github.com/Lelu-ai/lelu/issues/24) |
| No request body size limit on engine handlers | DoS | [#12](https://github.com/Lelu-ai/lelu/issues/12) |
| Public sandbox endpoint had no rate limiting | DoS | [#13](https://github.com/Lelu-ai/lelu/issues/13) |

The full list is issues #12 to #28, each titled with its finding code
(`[H1]`, `[M4]`, `[E2]` and so on).

The audit also led to the [What Lelu does not do](../README.md#what-lelu-does-not-do)
section. It exists because a control that is off by default and says nothing
about it is worse than no control.

## Next

The milestones are in priority order. Each one names the issues that close it.

### 1. Safe credentials by default

**Goal:** a fresh install does not let an agent approve its own human review
or claim to be a different agent.

- [#127](https://github.com/Lelu-ai/lelu/issues/127): separate agent, reviewer
  and admin credentials
- [#128](https://github.com/Lelu-ai/lelu/issues/128): bind the actor to the
  credential (per-agent keys or required workload tokens)
- [#87](https://github.com/Lelu-ai/lelu/issues/87): `lelu-mcp start` prints a
  generated reviewer key
- [#79](https://github.com/Lelu-ai/lelu/issues/79): every quickstart explains
  `LELU_REVIEWER_KEYS`
- [#123](https://github.com/Lelu-ai/lelu/issues/123): check OAuth clients that
  are already registered against the new redirect URI rules

### 2. An audit log you can check

**Goal:** anyone holding the log can prove it is complete and unmodified,
without trusting the engine that wrote it.

- [#116](https://github.com/Lelu-ai/lelu/issues/116): `lelu audit verify` to
  check receipt chains and signatures
- [#117](https://github.com/Lelu-ai/lelu/issues/117): record failed
  authentication, rate-limit rejections, token mints, agent registry and vault
  events
- Decide whether `LELU_AUDIT_BLOCK_ON_FULL` should default to `true`

### 3. A stronger enforcement path

**Goal:** a decision of "no" always looks like "no" to the caller, and the
agent cannot switch off the hook that enforces it.

- [#118](https://github.com/Lelu-ai/lelu/issues/118): stop the agent from
  editing the Claude Code plugin's own files
- [#119](https://github.com/Lelu-ai/lelu/issues/119): hook `MultiEdit` and
  `NotebookEdit`, and add a `Read` rule for secrets
- [#114](https://github.com/Lelu-ai/lelu/issues/114) and
  [#115](https://github.com/Lelu-ai/lelu/issues/115): return `allowed:false`
  for downgrades and compute redirects
- [#112](https://github.com/Lelu-ai/lelu/issues/112): cap the review queue so
  it cannot be flooded
- [#82](https://github.com/Lelu-ai/lelu/issues/82): `/healthz` reveals only
  liveness to anonymous callers
- [#89](https://github.com/Lelu-ai/lelu/issues/89): the Python and Go SDKs do
  not default to the hosted service

### 4. Supply chain

**Goal:** a user can check that what they installed was built from this
repository, and the project notices vulnerable dependencies quickly.

- [x] npm packages published with provenance
- [x] Engine and plugin binaries published with checksums and GitHub build
  provenance attestations
- [x] OpenSSF Scorecard runs weekly and on every push to `main`
- [ ] [#90](https://github.com/Lelu-ai/lelu/issues/90): `CODEOWNERS`,
  Dependabot and a `govulncheck` CI step
- [ ] [#124](https://github.com/Lelu-ai/lelu/issues/124): triage the
  `npm audit` findings in `sdk/typescript`
- [ ] Publish to PyPI with trusted publishing instead of a stored token
- [ ] Pin third-party GitHub Actions to commit SHAs
- [ ] A second owner on the GitHub organisation, npm and PyPI, so that one
  lost account cannot lock out or take over the project
- [ ] OpenSSF Best Practices badge

### 5. Process

- [ ] A written threat model for the engine, the MCP server and the plugins
- [ ] A second maintainer with security review rights (see
  [GOVERNANCE.md](../GOVERNANCE.md))
- [ ] A periodic re-audit once milestones 1 to 3 are done

## Not planned yet

These limits are known and are documented in the README. They are not on the
roadmap above because fixing them is a larger design change:

- **Running more than one engine replica.** The engine keeps state in SQLite
  and process memory.
- **Making the prompt-injection screen a real defence.** It matches phrases.
  It will stay advisory: it can make a decision stricter, never looser.
- **Verifying confidence signals.** This needs the signal to come from
  something the agent does not control, such as an LLM gateway.
