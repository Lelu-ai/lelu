#!/usr/bin/env bash
# install.sh — builds (or downloads) the Lelu Claude Code plugin's daemon +
# hook adapter and (re)starts the background daemon. Idempotent: safe to run
# again after an update, won't touch an existing mode file or ledger.
#
# If a Go toolchain is on PATH, builds from the source sitting right next to
# this script — always exactly the code you have checked out, whether that's
# a git clone or a marketplace-cached copy. Only falls back to downloading a
# prebuilt binary from GitHub Releases when Go isn't available, so someone
# without a Go toolchain (the common case for a plugin install) still ends
# up with a working plugin instead of a hard failure.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${LELU_DATA_DIR:-${LELU_HOME:-$HOME/.lelu/claude-plugin}}"
REPO="lelu-ai/lelu"
TAG_PREFIX="plugin-claude-code-v"

mkdir -p "$SCRIPT_DIR/bin"

socket_path="$DATA_DIR/daemon.sock"
if [ "$(uname -s)" = "Darwin" ]; then
  socket_length=$(printf '%s' "$socket_path" | wc -c | tr -d ' ')
  if [ "$socket_length" -gt 103 ]; then
    echo "error: daemon socket path is ${socket_length} bytes; macOS supports at most 103: ${socket_path}" >&2
    exit 1
  fi
fi

build_from_source() {
  echo "==> Building lelu-hook and lelu-daemon from source"
  cd "$SCRIPT_DIR/daemon"
  go build -o "$SCRIPT_DIR/hooks/lelu-hook" ./cmd/lelu-hook
  go build -o "$SCRIPT_DIR/bin/lelu-daemon" ./cmd/lelu-daemon
}

# download_prebuilt fetches lelu-daemon/lelu-hook for this OS/arch from the
# latest plugin-claude-code-v* GitHub release. Deliberately NOT
# /releases/latest/download/ — this repo also ships engine and SDK releases
# under their own tag prefixes, and "latest" is whichever of THOSE was
# published most recently, not necessarily this component's.
download_prebuilt() {
  case "$(uname -s)" in
    Linux)  os="linux" ;;
    Darwin) os="darwin" ;;
    *) echo "error: no prebuilt binary for $(uname -s); install Go from https://go.dev/dl to build from source instead." >&2; return 1 ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) arch="amd64" ;;
    aarch64|arm64) arch="arm64" ;;
    *) echo "error: no prebuilt binary for $(uname -m); install Go from https://go.dev/dl to build from source instead." >&2; return 1 ;;
  esac

  if [ -n "${LELU_PLUGIN_VERSION:-}" ]; then
    tag="${TAG_PREFIX}${LELU_PLUGIN_VERSION}"
  else
    release_json=$(mktemp)
    release_curl_args=(-sS)
    if [ -n "${GITHUB_TOKEN:-}" ]; then
      release_curl_args+=("-H" "Authorization: Bearer ${GITHUB_TOKEN}")
    fi
    release_status=$(curl "${release_curl_args[@]}" -o "$release_json" -w '%{http_code}' "https://api.github.com/repos/${REPO}/releases" || true)
    case "$release_status" in
      2[0-9][0-9])
        tag="$(grep -o "\"tag_name\": *\"${TAG_PREFIX}[^\"]*\"" "$release_json" \
          | head -1 | sed -E 's/.*"([^"]+)"$/\1/' || true)"
        ;;
      *)
        echo "error: GitHub release lookup failed (HTTP ${release_status:-unknown}). Set LELU_PLUGIN_VERSION or provide GITHUB_TOKEN and retry." >&2
        rm -f "$release_json"
        return 1
        ;;
    esac
    rm -f "$release_json"
  fi
  if [ -z "${tag:-}" ]; then
    echo "error: no published ${TAG_PREFIX}* release was found. Set LELU_PLUGIN_VERSION to a published version and retry." >&2
    return 1
  fi

  base="https://github.com/${REPO}/releases/download/${tag}"
  tmp_daemon="$(mktemp)"
  tmp_hook="$(mktemp)"
  tmp_sums="$(mktemp)"
  echo "==> Downloading prebuilt binaries (${tag}, ${os}/${arch})"
  if ! curl -fsSL -o "$tmp_daemon" "${base}/lelu-daemon-${os}-${arch}" \
    || ! curl -fsSL -o "$tmp_hook" "${base}/lelu-hook-${os}-${arch}" \
    || ! curl -fsSL -o "$tmp_sums" "${base}/SHA256SUMS.txt"; then
    echo "error: failed to download prebuilt binaries from ${base}" >&2
    rm -f "$tmp_daemon" "$tmp_hook" "$tmp_sums"
    return 1
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    checksum_command=(sha256sum)
  elif command -v shasum >/dev/null 2>&1; then
    checksum_command=(shasum -a 256)
  else
    echo "error: sha256sum or shasum is required to verify downloaded binaries." >&2
    rm -f "$tmp_daemon" "$tmp_hook" "$tmp_sums"
    return 1
  fi

  checksum_dir=$(mktemp -d)
  daemon_name="lelu-daemon-${os}-${arch}"
  hook_name="lelu-hook-${os}-${arch}"
  mv "$tmp_daemon" "$checksum_dir/$daemon_name"
  mv "$tmp_hook" "$checksum_dir/$hook_name"
  if ! grep -E "^[[:xdigit:]]{64}[[:space:]]+\*?(${daemon_name}|${hook_name})$" "$tmp_sums" > "$checksum_dir/SHA256SUMS.txt" \
    || [ "$(wc -l < "$checksum_dir/SHA256SUMS.txt")" -ne 2 ] \
    || ! (cd "$checksum_dir" && "${checksum_command[@]}" -c SHA256SUMS.txt); then
    echo "error: checksum verification failed for prebuilt binaries from ${base}" >&2
    rm -rf "$checksum_dir" "$tmp_sums"
    return 1
  fi
  rm -f "$tmp_sums"

  mv "$checksum_dir/$daemon_name" "$SCRIPT_DIR/bin/lelu-daemon"
  mv "$checksum_dir/$hook_name" "$SCRIPT_DIR/hooks/lelu-hook"
  rmdir "$checksum_dir"
  chmod +x "$SCRIPT_DIR/bin/lelu-daemon" "$SCRIPT_DIR/hooks/lelu-hook"
}

if command -v go >/dev/null 2>&1; then
  build_from_source
elif ! download_prebuilt; then
  echo "error: no Go toolchain found and no prebuilt binary could be downloaded." >&2
  echo "       Install Go from https://go.dev/dl and rerun, or set LELU_PLUGIN_VERSION to a published release." >&2
  exit 1
fi

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

for _ in $(seq 1 30); do
  if [ -S "$socket_path" ]; then
    break
  fi
  if ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    break
  fi
  sleep 0.1
done
if kill -0 "$(cat "$PID_FILE")" 2>/dev/null && [ -S "$socket_path" ]; then
  echo "==> lelu-daemon running (pid $(cat "$PID_FILE")), socket at $DATA_DIR/daemon.sock"
  echo "==> Done. The PreToolUse hook is registered via hooks/hooks.json — no further setup needed inside Claude Code."
else
  echo "error: lelu-daemon failed to listen on $socket_path — check $DATA_DIR/daemon.log" >&2
  exit 1
fi
