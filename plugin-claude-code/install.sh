#!/usr/bin/env bash
# install.sh — builds the Lelu Claude Code plugin's daemon + hook adapter and
# (re)starts the background daemon. Idempotent: safe to run again after an
# update, won't touch an existing mode file or ledger.
#
# Requires a local Go toolchain for now (this is the wedge stage — prebuilt
# per-platform binary downloads are a follow-up, not faked here).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${LELU_DATA_DIR:-$HOME/.lelu/claude-plugin}"

if ! command -v go >/dev/null 2>&1; then
  echo "error: the Lelu Claude Code plugin currently builds from source and needs a Go toolchain (go.dev/dl) on PATH." >&2
  exit 1
fi

echo "==> Building lelu-hook and lelu-daemon"
cd "$SCRIPT_DIR/daemon"
mkdir -p "$SCRIPT_DIR/bin"
go build -o "$SCRIPT_DIR/hooks/lelu-hook" ./cmd/lelu-hook
go build -o "$SCRIPT_DIR/bin/lelu-daemon" ./cmd/lelu-daemon

mkdir -p "$DATA_DIR"
if [ ! -f "$DATA_DIR/mode" ]; then
  echo "shadow" > "$DATA_DIR/mode"
  echo "==> First install: starting in shadow mode (nothing is blocked yet). Run /lelu:lelu-enforce inside Claude Code when you're ready."
fi

PID_FILE="$DATA_DIR/daemon.pid"
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "==> Stopping previous lelu-daemon (pid $(cat "$PID_FILE"))"
  kill "$(cat "$PID_FILE")" 2>/dev/null || true
  sleep 0.2
fi

echo "==> Starting lelu-daemon"
LELU_DATA_DIR="$DATA_DIR" \
LELU_POLICY_PATH="$SCRIPT_DIR/policies/defaults.json" \
  nohup "$SCRIPT_DIR/bin/lelu-daemon" >>"$DATA_DIR/daemon.log" 2>&1 &
echo $! > "$PID_FILE"

sleep 0.3
if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "==> lelu-daemon running (pid $(cat "$PID_FILE")), socket at $DATA_DIR/daemon.sock"
  echo "==> Done. The PreToolUse hook is registered via hooks/hooks.json — no further setup needed inside Claude Code."
else
  echo "error: lelu-daemon failed to start — check $DATA_DIR/daemon.log" >&2
  exit 1
fi
