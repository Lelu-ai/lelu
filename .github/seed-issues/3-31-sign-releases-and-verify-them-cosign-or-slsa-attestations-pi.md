---
title: Sign releases and verify them: cosign or SLSA attestations, pinned hash in `lelu-mcp`
labels: help wanted,security,level-3-advanced
---
`lelu-mcp start` downloads the newest engine release and checks a SHA-256 file served by the same release. `scripts/install.sh` installs with no check at all. Nothing is signed or attested.

**What to do** add cosign keyless signing and build provenance to the release workflows, embed the expected hash for each engine version in the `lelu-mcp` package, re-verify the cached binary on every start, and make `install.sh` verify before installing.

Audit reference: C-02, M2, V26.
