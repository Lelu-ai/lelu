# Security Policy

## Supported Versions

Lelu is pre-1.0 across the engine and SDKs. Only the latest released version
of each component is supported with security fixes — there is no long-term
support branch yet.

| Component          | Supported                          |
| ------------------ | ---------------------------------- |
| Engine             | latest `engine-v*` tag             |
| MCP server         | latest `lelu-mcp` release on npm   |
| Claude Code plugin | latest `plugin-claude-code-v*` tag |
| Python SDK         | latest release on PyPI             |
| TypeScript SDK     | latest release on npm              |
| Go SDK             | latest tagged release              |

The MCP server and the Claude Code plugin are listed because both sit on the
enforcement path: a finding in either one is a finding against the
authorization decisions Lelu makes, and is in scope here.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately rather than opening a
public issue — use GitHub's
[private vulnerability reporting](https://github.com/Lelu-ai/lelu/security/advisories/new)
for this repository (Security tab → "Report a vulnerability").

If that button is not available to you, email **support@lelu-ai.com** with
the same content instead. Either route reaches the maintainers privately; do
not open a public issue for a security finding.

Include what you'd include in any report: affected component and version,
reproduction steps, and impact. Credit is given in the advisory and changelog
unless you'd prefer otherwise.

## What happens after you report

| Step | Target |
|---|---|
| Acknowledge the report | within 3 business days |
| First assessment (confirmed or not, and severity) | within 7 days |
| Fix released for a confirmed critical or high finding | within 30 days |
| Public GitHub security advisory | when the fix is released |

These are targets for a small team, not contractual guarantees. If one will be
missed, we tell you why and when to expect an update.

## Verifying a release

- **npm packages** (`lelu-agent-auth`, `lelu-mcp`, `lelu-openclaw`) are
  published from CI with npm provenance. Check with `npm audit signatures`
  in a project that installs them.
- **Engine and Claude Code plugin binaries** on GitHub Releases come with a
  `SHA256SUMS.txt` file and a GitHub build provenance attestation:

  ```bash
  sha256sum --check --ignore-missing SHA256SUMS.txt
  gh attestation verify lelu-engine-linux-amd64 -R Lelu-ai/lelu
  ```

## Planned security work

What we are fixing next, and in what order, is in
[docs/SECURITY_ROADMAP.md](docs/SECURITY_ROADMAP.md).
