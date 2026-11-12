---
title: Ship `lelu audit verify` to check receipt chains and signatures
labels: help wanted,enhancement,level-2-intermediate
---
Audit receipts are signed and hash-chained, but no command lets a user verify them. `audit.VerifyChainReport` exists and is used only by tests.

**What to do**
- Add `lelu-cli audit verify <file.jsonl> --jwks <url|file>` that reports edits, gaps, reordering and (given `--high-water N`) truncation.
- Document the receipt format in `docs/`.
- Add a test fixture with a deliberately broken chain.

Audit reference: AUD-04, AUD-05.
