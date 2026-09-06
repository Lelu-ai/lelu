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
reproduction steps, and impact. We'll acknowledge new reports and keep you
updated as we investigate and fix confirmed issues; credit is given in the
advisory and changelog unless you'd prefer otherwise.
