#!/bin/sh
# Lelu engine installer — no account required.
#
#   curl -sSL https://raw.githubusercontent.com/Lelu-ai/lelu/main/scripts/install.sh | sh
#
# Downloads the newest static engine binary from GitHub Releases into
# ~/.lelu/bin (override with LELU_INSTALL_DIR), checks it against the
# release's SHA256SUMS.txt, and prints a quickstart.
# Pin a version with LELU_ENGINE_VERSION=0.3.1 (a leading "v" is accepted).
# Set GITHUB_TOKEN to raise the GitHub API rate limit for the release lookup.

set -eu

REPO="Lelu-ai/lelu"
TAG_PREFIX="engine-v"
CHECKSUMS="SHA256SUMS.txt"
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

if command -v curl >/dev/null 2>&1; then
  HTTP="curl"
elif command -v wget >/dev/null 2>&1; then
  HTTP="wget"
else
  echo "error: curl or wget is required." >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  SHA256="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  SHA256="shasum -a 256"
else
  echo "error: sha256sum or shasum is required to verify the download." >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
trap 'exit 1' HUP INT PIPE TERM

# fetch URL FILE: download URL to FILE; fails on any HTTP error.
fetch() {
  if [ "$HTTP" = "curl" ]; then
    curl -fsSL -o "$2" "$1"
  else
    wget -qO "$2" "$1"
  fi
}

# fetch_api URL FILE: like fetch, with a GitHub token when one is set.
fetch_api() {
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    if [ "$HTTP" = "curl" ]; then
      curl -fsSL -H "Authorization: Bearer ${GITHUB_TOKEN}" -o "$2" "$1"
    else
      wget -q --header="Authorization: Bearer ${GITHUB_TOKEN}" -O "$2" "$1"
    fi
  else
    fetch "$1" "$2"
  fi
}

# latest_tag: prints the newest engine-v* tag whose release has both this
# platform's binary and SHA256SUMS.txt. Not /releases/latest: this repo also
# publishes SDK and plugin releases, and "latest" is whichever of them was
# published last. Releases are listed newest first; asset download URLs
# carry the tag, so no JSON parser is needed.
latest_tag() {
  page=1
  while [ "$page" -le 10 ]; do
    list="$WORK/releases-$page.json"
    if ! fetch_api "https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}" "$list"; then
      echo "error: could not list ${REPO} releases from the GitHub API (offline, rate limited, or GITHUB_TOKEN rejected)." >&2
      echo "       Set LELU_ENGINE_VERSION to pin a version, or GITHUB_TOKEN to raise the rate limit, and retry." >&2
      return 1
    fi
    grep -o '"browser_download_url" *: *"[^"]*"' "$list" \
      | sed -n "s|.*/releases/download/${TAG_PREFIX}\([^/\"]*\)/\([^/\"]*\)\"\$|\1 \2|p" \
      > "$WORK/assets-$page.txt" || true
    for v in $(cut -d' ' -f1 "$WORK/assets-$page.txt" | uniq); do
      if grep -qxF "$v $ASSET" "$WORK/assets-$page.txt" \
        && grep -qxF "$v $CHECKSUMS" "$WORK/assets-$page.txt"; then
        echo "${TAG_PREFIX}${v}"
        return 0
      fi
    done
    # A page with no releases on it means the list is exhausted.
    grep -q '"tag_name"' "$list" || break
    page=$((page + 1))
  done
  echo "error: no ${TAG_PREFIX}* release of ${REPO} has both ${ASSET} and ${CHECKSUMS} attached." >&2
  echo "       Set LELU_ENGINE_VERSION to pin a version and retry." >&2
  return 1
}

if [ -n "${LELU_ENGINE_VERSION:-}" ]; then
  VERSION="${LELU_ENGINE_VERSION#engine-}"
  VERSION="${VERSION#v}"
  TAG="${TAG_PREFIX}${VERSION}"
else
  TAG="$(latest_tag)"
fi

BASE="https://github.com/${REPO}/releases/download/${TAG}"
echo "Downloading ${ASSET} (${TAG}) …"
if ! fetch "${BASE}/${ASSET}" "$WORK/$ASSET"; then
  echo "error: could not download ${BASE}/${ASSET}" >&2
  echo "       Check that release ${TAG} exists and has a ${OS}/${ARCH} binary: https://github.com/${REPO}/releases" >&2
  exit 1
fi
if ! fetch "${BASE}/${CHECKSUMS}" "$WORK/$CHECKSUMS"; then
  echo "error: could not download ${BASE}/${CHECKSUMS}; refusing to install an unverified binary." >&2
  exit 1
fi

# Keep only this asset's line ("<sha256>  <name>", or "*<name>" in binary
# mode) and let sha256sum/shasum check it, so a missing entry fails too.
grep -E "^[[:xdigit:]]{64}[[:space:]]+\*?${ASSET}\$" "$WORK/$CHECKSUMS" > "$WORK/expected.txt" || true
if [ "$(wc -l < "$WORK/expected.txt" | tr -d ' ')" -ne 1 ]; then
  echo "error: ${CHECKSUMS} in ${TAG} has no single entry for ${ASSET}; refusing to install an unverified binary." >&2
  exit 1
fi
if ! (cd "$WORK" && $SHA256 -c expected.txt >/dev/null 2>&1); then
  echo "error: checksum mismatch for ${ASSET} from ${TAG}." >&2
  echo "       expected: $(cut -d' ' -f1 "$WORK/expected.txt")" >&2
  echo "       got:      $(cd "$WORK" && $SHA256 "$ASSET" | cut -d' ' -f1)" >&2
  echo "       The download is corrupt or was tampered with; nothing was installed." >&2
  exit 1
fi
echo "Verified ${ASSET} against ${CHECKSUMS}."

mkdir -p "$INSTALL_DIR"
chmod +x "$WORK/$ASSET"
mv "$WORK/$ASSET" "$INSTALL_DIR/lelu-engine"

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
