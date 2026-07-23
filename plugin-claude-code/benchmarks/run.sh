#!/usr/bin/env bash
# Regenerates benchmarks/report.md from the real corpus and real code in
# daemon/cmd/benchmark-hookify-vs-lelu — run this after any change to either.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR/../daemon"
go run ./cmd/benchmark-hookify-vs-lelu "$SCRIPT_DIR/../policies/defaults.json" > "$SCRIPT_DIR/report.md"

echo "Wrote $SCRIPT_DIR/report.md"
