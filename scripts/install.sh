#!/bin/sh
# Lelu engine installer — no account required.
#
#   curl -sSL https://raw.githubusercontent.com/Lelu-ai/lelu/main/scripts/install.sh | sh
#
# Downloads the latest static engine binary from GitHub Releases into
# ~/.lelu/bin (override with LELU_INSTALL_DIR) and prints a quickstart.
# Pin a version with LELU_ENGINE_VERSION=0.1.0.

set -eu

REPO="Lelu-ai/lelu"
INSTALL_DIR="${LELU_INSTALL_DIR:-$HOME/.lelu/bin}"

case "$(uname -s)" in
  Linux)  OS="linux" ;;
  Darwin) OS="darwin" ;;
  *) echo "Unsupported OS: $(uname -s). Use Docker instead: docker run ghcr.io/lelu-ai/lelu-engine" >&2; exit 1 ;;
esac

case "$(uname -m)" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

ASSET="lelu-engine-${OS}-${ARCH}"
if [ -n "${LELU_ENGINE_VERSION:-}" ]; then
  URL="https://github.com/${REPO}/releases/download/engine-v${LELU_ENGINE_VERSION}/${ASSET}"
else
  URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"
fi

echo "Downloading ${ASSET} …"
mkdir -p "$INSTALL_DIR"
TMP="$(mktemp)"
if command -v curl >/dev/null 2>&1; then
  curl -fsSL -o "$TMP" "$URL"
else
  wget -qO "$TMP" "$URL"
fi
chmod +x "$TMP"
mv "$TMP" "$INSTALL_DIR/lelu-engine"

echo ""
echo "Installed: $INSTALL_DIR/lelu-engine"
echo ""
echo "Quickstart (runs entirely on your machine — no account needed):"
echo ""
echo "  POLICY_PATH=./auth.yaml LISTEN_ADDR=:8080 $INSTALL_DIR/lelu-engine"
echo ""
echo "  curl -X POST localhost:8080/v1/agent/authorize \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"actor\":\"my_agent\",\"action\":\"read_invoices\"}'"
echo ""
echo "Sample policy: https://github.com/${REPO}/blob/main/config/auth.yaml"
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *) echo ""; echo "Tip: add it to your PATH:  export PATH=\"\$PATH:$INSTALL_DIR\"" ;;
esac
