<p align="center">
	<img src="https://raw.githubusercontent.com/lelu-auth/lelu/main/platform/ui/public/logo.svg" alt="Lelu logo" width="120" />
</p>

# Lelu

## Quick Start (Docker)

Run all Lelu services with one command:

```bash
docker compose up -d --build
```

Or use the public engine image directly from Docker Hub:

```bash
docker pull abenezer0923/lelu-engine:latest
docker run --rm -p 8083:8080 abenezer0923/lelu-engine:latest
```

Key local endpoints:

- Engine: `http://localhost:8083/healthz`
- Platform: `http://localhost:9091/healthz`
- UI: `http://localhost:3002`
- MCP: `http://localhost:3003/healthz`

Quick check that functions are working:

```bash
curl http://localhost:8083/healthz
```

Expected output includes `ok`.

## About the Project

Lelu is a framework-agnostic authorization engine for AI agents. It combines policy evaluation, confidence-aware controls, runtime risk checks, and human-review workflows in one system.

It is designed so teams can ship agent features faster without weakening security.

Out of the box, Lelu provides:

- Confidence-aware authorization
- Prompt-injection prefiltering
- Human-in-the-loop review queue
- Runtime risk evaluation
- Short-lived (JIT) scoped tokens
- Audit trail and incident hooks

## Why Lelu

Authorization for AI agents is still a half-solved problem. Most tools handle static rules but do not account for model uncertainty, dynamic risk, and operational safety in one flow.

Lelu solves this by making decisions through a layered pipeline:

- Injection check
- Confidence resolution and gate
- Policy evaluation (YAML or Rego)
- Risk evaluation
- Most-restrictive final decision merge

This helps teams avoid over-permissive agent behavior while keeping developer workflow simple.



## Contribution

Lelu is free and open source under the MIT License.

You can support the project by:

- Contributing code
- Suggesting features
- Reporting bugs and issues
- Improving documentation and examples

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Security

If you discover a security issue, please report it privately to:

`abenezergetachew0923@gmail.com`

Reports will be reviewed promptly and handled responsibly.

## License

MIT. See [LICENSE](LICENSE).
