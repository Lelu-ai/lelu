# Governance

This document says who makes decisions about Lelu, how they are made, and
what the project promises about its open source code. It is short on purpose:
Lelu is a small project, and the rules should match how it actually works.

## Roles

**Users** run Lelu or one of its SDKs. They shape the project through issues,
Discussions and security reports.

**Contributors** have had a pull request merged. Anyone can become one; see
[CONTRIBUTING.md](CONTRIBUTING.md).

**Maintainers** review and merge pull requests, cut releases, triage issues and
handle security reports. They hold write access to this repository and publish
rights on the package registries.

| Maintainer | GitHub | Role |
|---|---|---|
| Abenezer Getachew | [Abenezer0923](https://github.com/Abenezer0923) | Project lead |

Lelu currently has one maintainer. Adding a second, with full review and
release rights, is an explicit goal. The path is below.

## How decisions are made

- **Everyday changes** (bug fixes, docs, tests, new integrations) are decided
  in the pull request. A maintainer approves and merges.
- **Significant changes** need a written proposal first: an issue labelled
  `proposal`, open for at least 7 days for comment. This covers changes to the
  HTTP API or decision semantics, the policy format, the security model (what
  Lelu claims to protect against), the license, and this document.
- **Disagreements** are settled by discussion and, where that fails, by the
  maintainers. While there is a single maintainer, the project lead decides
  and writes down the reason in the issue.
- **Security-sensitive changes** (authentication, authorization decisions,
  the audit chain, the enforcement hooks) must come with tests. Once there are
  two maintainers, they also need a review from a maintainer who did not write
  them.

## Becoming a maintainer

A contributor can be nominated by any maintainer, or can ask, after a sustained
record of good work: several merged pull requests, careful reviews of other
people's changes, and help in issues or Discussions. The existing maintainers
agree by consensus and record the decision in a pull request that updates the
table above.

A maintainer who is inactive for six months, or who asks to step down, moves to
an emeritus list. Access is removed at that point.

## Releases

Releases are cut by [release-please](.github/release-please-config.json) from
conventional commits on `main`. Each component has its own tag prefix
(`engine-v*`, `plugin-claude-code-v*`, `sdk/go/v*`, and so on).

- npm packages are published from CI with npm provenance.
- Engine and Claude Code plugin binaries are published from CI with a
  `SHA256SUMS.txt` file and a GitHub build provenance attestation.

How to verify a release is described in [SECURITY.md](SECURITY.md).

## Security

Vulnerability reports go through the private channel described in
[SECURITY.md](SECURITY.md), never public issues. Maintainers handle reports,
coordinate fixes and publish GitHub security advisories. Planned security work
is tracked in [docs/SECURITY_ROADMAP.md](docs/SECURITY_ROADMAP.md).

## Open source and the hosted service

Lelu is open source first. Everything in this repository (the engine, the
SDKs, the MCP server, the Claude Code and OpenClaw plugins, and the dashboard)
is MIT licensed and can be self-hosted with no account.

The project lead also runs a hosted version at lelu-ai.com with paid plans.
Those plans pay for hosting, authorize-call volume and support. The project
makes these commitments about that relationship:

1. **No security feature is held back from the open source code.** A control
   that makes an authorization decision safer ships here first, under MIT.
2. **No relicensing of released code.** Code released under MIT stays under
   MIT.
3. **The hosted service runs the code in this repository.** It does not depend
   on a private fork of the engine.
4. **Project decisions are made here, in public**, under the process above,
   not in the hosted service's roadmap.

## Code of conduct

Everyone taking part in the project follows the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Changing this document

Changes to this document follow the significant-change process above: a
`proposal` issue open for at least 7 days, then a pull request.
