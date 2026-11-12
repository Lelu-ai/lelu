---
title: Add tests that every shipped Rego sample loads
labels: good first issue,tests,level-1-first-timer
---
The four sample policies (`config/auth.rego`, `config/skills/*.rego`) failed to parse with the bundled OPA until `import rego.v1` was added. Nothing in CI would have caught it.

**What to do**
- Add a test in `engine/internal/evaluator/` that loads each `.rego` file under `config/` with `LoadRegoPolicy` and asserts no error.
- Add one decision assertion per sample (for example, `approve_refunds` at confidence 0.95 is allowed by `auth.rego`).

**Done when** `go test ./engine/internal/evaluator/...` fails if any sample stops parsing.

Audit reference: POL-13a.
