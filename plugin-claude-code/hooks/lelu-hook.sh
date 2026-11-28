#!/bin/sh
# Lelu hook launcher for Claude Code.
#
# hooks.json runs this script. It makes sure the Lelu checker for this plugin
# version is installed, then passes the hook input (stdin) to lelu-hook,
# which asks the local lelu-daemon for a decision.
#
# Why a download: the checker is a compiled Go program, too large to keep in
# the plugin folder. The release workflow
# (.github/workflows/plugin-claude-code-release.yml) builds it from
# plugin-claude-code/daemon and publishes it on the GitHub release
# plugin-claude-code-v$LELU_PLUGIN_VERSION as one gzip file per OS and CPU,
# about 1.5 MB. This script downloads the file for this machine, checks it
# against the release's SHA256SUMS.txt, unpacks it into
# $data_dir/bin/$LELU_PLUGIN_VERSION (where plugin updates don't remove it),
# and links lelu-hook and lelu-daemon to it.
#
# Network: only github.com and release-assets.githubusercontent.com, only
# over HTTPS, only those two files, only until the install succeeds.
# Nothing is uploaded and no data about your session is sent.
#
# Usage:
#   lelu-hook.sh            PreToolUse: run lelu-hook (installing if needed)
#   lelu-hook.sh session    SessionStart: start the download in the background
#                           if needed, welcome a new user once, and check that
#                           the plugin's own files are unchanged
#   lelu-hook.sh download   the background download itself
#
# Session start never waits for the download. Until it finishes, tool calls
# in shadow mode (the default, which blocks nothing) pass straight through.
# In enforce mode a tool call waits for the download, or runs it, and if Lelu
# still can't check the action it is routed to "ask", so stopping Lelu does
# not get an action past it once blocking is on. LELU_FAIL_CLOSED=1 or =0
# overrides the mode, as it does in lelu-hook.
#
# A local build wins: if install.sh has built hooks/lelu-hook and
# bin/lelu-daemon inside the plugin folder, those are used and nothing is
# downloaded.

set -u

LELU_PLUGIN_VERSION="0.3.0"
REPO="Lelu-ai/lelu"

mode="${1:-hook}"
[ "$mode" = "install" ] && mode=session # name used by 0.2.x hooks.json
plugin_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
data_dir="${LELU_DATA_DIR:-${LELU_HOME:-$HOME/.lelu/claude-plugin}}"
bin_dir="$data_dir/bin/$LELU_PLUGIN_VERSION"
lock="$data_dir/bin/.download-$LELU_PLUGIN_VERSION.lock"
failed="$data_dir/bin/.download-$LELU_PLUGIN_VERSION.failed"
problem=""

# fail_closed is true when an action Lelu cannot check should be routed to
# "ask": LELU_FAIL_CLOSED decides if set, otherwise enforce mode does.
fail_closed() {
  case "${LELU_FAIL_CLOSED:-}" in
    1 | true) return 0 ;;
    0 | false) return 1 ;;
  esac
  [ "$(cat "$data_dir/mode" 2>/dev/null)" = "enforce" ]
}

# ask routes the current tool call to the user, with $1 as the reason, and
# exits. Messages are fixed text with no double quotes or backslashes, so
# they need no JSON escaping.
ask() {
  printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"Lelu could not check this action, and it is enforcing, so it needs your approval: %s"}}\n' "$1" "$1"
  exit 0
}

installed() {
  [ -x "$bin_dir/lelu-hook" ] && [ -x "$bin_dir/lelu-daemon" ]
}

# After a failed download, wait 10 minutes before trying again, so an
# offline machine does not retry on every tool call.
recently_failed() {
  [ -f "$failed" ] && [ -n "$(find "$failed" -mmin -10 2>/dev/null)" ]
}

fetch() { # fetch URL FILE
  if command -v curl >/dev/null 2>&1; then
    # No overall time limit, so a slow link still finishes; give up only if
    # the transfer stalls below 1 KB/s for a minute.
    curl -fsSL --proto '=https' --proto-redir '=https' --connect-timeout 15 \
      --speed-limit 1024 --speed-time 60 --retry 2 -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget -q --https-only --timeout=60 --tries=3 -O "$2" "$1"
  else
    return 1
  fi
}

sha256_of() { # sha256_of FILE
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d ' ' -f 1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d ' ' -f 1
  else
    return 1
  fi
}

# The download lock is a directory holding the PID of the process that is
# downloading. A lock whose process is gone (for example, one stopped by a
# hook timeout) counts as free. One older than 30 minutes is cleared anyway,
# in case its PID was reused.
take_lock() {
  mkdir "$lock" 2>/dev/null && echo "$$" >"$lock/pid"
}

lock_owner_alive() {
  [ -d "$lock" ] || return 1
  [ -n "$(find "$lock" -maxdepth 0 -mmin +30 2>/dev/null)" ] && return 1
  pid=$(cat "$lock/pid" 2>/dev/null)
  if [ -z "$pid" ]; then
    # The owner may not have written its PID yet; give it a minute.
    [ -z "$(find "$lock" -maxdepth 0 -mmin +1 2>/dev/null)" ]
    return
  fi
  kill -0 "$pid" 2>/dev/null
}

clear_lock() {
  rm -f "$lock/pid"
  rmdir "$lock" 2>/dev/null
}

remove_tmp() {
  rm -f "$1/SHA256SUMS.txt" "$1/lelu.gz" "$1/lelu"
  rmdir "$1" 2>/dev/null
}

# download_release installs the checker. It returns 0 on success; otherwise
# it sets $problem and returns 1, or returns 2 if another process holds the
# download lock.
download_release() {
  case "$(uname -s)" in
    Linux) os=linux ;;
    Darwin) os=darwin ;;
    *) problem="Lelu has no prebuilt checker for this OS. Build it with plugin-claude-code/install.sh."; return 1 ;;
  esac
  case "$(uname -m)" in
    x86_64 | amd64) arch=amd64 ;;
    arm64 | aarch64) arch=arm64 ;;
    *) problem="Lelu has no prebuilt checker for this CPU. Build it with plugin-claude-code/install.sh."; return 1 ;;
  esac
  mkdir -p "$data_dir/bin" || { problem="Lelu could not create its data directory."; return 1; }

  lock_owner_alive || clear_lock
  take_lock || return 2
  # Holding the lock: remove what an interrupted download left behind.
  for old in "$data_dir/bin"/.tmp.*; do
    [ -d "$old" ] && remove_tmp "$old"
  done
  tmp=$(mktemp -d "$data_dir/bin/.tmp.XXXXXX") || { clear_lock; problem="Lelu could not create a temporary directory."; return 1; }
  trap 'remove_tmp "$tmp"; clear_lock; exit 1' INT TERM HUP

  asset="lelu-$os-$arch.gz"
  base="https://github.com/$REPO/releases/download/plugin-claude-code-v$LELU_PLUGIN_VERSION"
  result=ok
  if ! fetch "$base/SHA256SUMS.txt" "$tmp/SHA256SUMS.txt" || ! fetch "$base/$asset" "$tmp/lelu.gz"; then
    result=download
  else
    want=$(awk -v f="$asset" '$2 == f || $2 == "*" f { print $1 }' "$tmp/SHA256SUMS.txt")
    if ! got=$(sha256_of "$tmp/lelu.gz"); then
      result=nosha
    elif [ -z "$want" ] || [ "$want" != "$got" ]; then
      result=checksum
    elif ! gzip -dc "$tmp/lelu.gz" >"$tmp/lelu" 2>/dev/null; then
      result=unpack
    else
      chmod 755 "$tmp/lelu"
      mkdir -p "$bin_dir" &&
        mv "$tmp/lelu" "$bin_dir/lelu" &&
        ln -sf lelu "$bin_dir/lelu-daemon" &&
        ln -sf lelu "$bin_dir/lelu-hook" || result=move
    fi
  fi
  remove_tmp "$tmp"
  clear_lock
  trap - INT TERM HUP

  case "$result" in
    ok) rm -f "$failed"; return 0 ;;
    checksum) problem="Lelu downloaded a checker that did not match the release checksums and did not install it." ;;
    nosha) problem="Lelu needs sha256sum or shasum to check its download." ;;
    unpack) problem="Lelu needs gzip to unpack its download." ;;
    move) problem="Lelu could not install its checker into its data directory." ;;
    *) problem="Lelu could not download its checker from GitHub (curl or wget and network access are needed)." ;;
  esac
  touch "$failed"
  return 1
}

# start_background_download runs the download in its own process, so the
# hook that started it returns at once.
start_background_download() {
  lock_owner_alive && return 0
  if command -v setsid >/dev/null 2>&1; then
    setsid sh "$0" download </dev/null >/dev/null 2>&1 &
  else
    nohup sh "$0" download </dev/null >/dev/null 2>&1 &
  fi
}

# plugin_files_changed is true if the plugin's own files changed since this
# plugin version first ran on this machine: an edited hooks.json, launcher or
# default policy can switch Lelu off or loosen it. The first run records the
# hashes; later runs compare. It is a tripwire for edits made outside Claude
# Code; inside Claude Code, changes to the plugin folder are routed to "ask".
plugin_files_changed() {
  record="$data_dir/plugin-files-$LELU_PLUGIN_VERSION.sha256"
  current=""
  for f in hooks/hooks.json hooks/lelu-hook.sh policies/defaults.json; do
    h=$(sha256_of "$plugin_root/$f") || return 1
    current="$current$h  $f
"
  done
  if [ ! -f "$record" ]; then
    mkdir -p "$data_dir" && printf '%s' "$current" >"$record"
    return 1
  fi
  [ "$(cat "$record")" != "$(printf '%s' "$current")" ]
}

local_build=""
if [ -x "$plugin_root/hooks/lelu-hook" ] && [ -x "$plugin_root/bin/lelu-daemon" ]; then
  # Local build from install.sh. lelu-hook finds the daemon through
  # CLAUDE_PLUGIN_ROOT, which Claude Code sets.
  local_build=1
  hook="$plugin_root/hooks/lelu-hook"
else
  hook="$bin_dir/lelu-hook"
  LELU_DAEMON_BIN="$bin_dir/lelu-daemon"
  export LELU_DAEMON_BIN
fi

case "$mode" in
  download)
    download_release
    exit 0
    ;;

  session)
    messages=""
    # Welcome a new user once. Someone upgrading already has a ledger.
    if [ ! -f "$data_dir/.welcome-shown" ]; then
      if [ ! -f "$data_dir/ledger.jsonl" ]; then
        if fail_closed; then
          messages="Lelu is on and enforcing: it blocks or asks before risky actions. Run /lelu:status to see what it caught."
        else
          messages="Lelu is on, in shadow mode: it records what it would have blocked and blocks nothing yet. Run /lelu:status to see what it caught, and /lelu:enforce when you want it to block."
        fi
      fi
      mkdir -p "$data_dir" && : >"$data_dir/.welcome-shown"
    fi
    if [ -z "$local_build" ]; then
      if installed; then
        :
      elif recently_failed; then
        messages="$messages Lelu could not download its checker recently and will retry in a few minutes; until then it is not checking actions."
      else
        start_background_download
        messages="$messages Lelu is downloading its 1.5 MB checker in the background, once per version; actions are checked as soon as it finishes."
      fi
      if plugin_files_changed; then
        messages="$messages Lelu's own plugin files (hooks.json, lelu-hook.sh or policies/defaults.json) changed since this version was installed. If you did not change them, reinstall the plugin. To accept the change, delete plugin-files-$LELU_PLUGIN_VERSION.sha256 in the Lelu data directory."
      fi
    fi
    messages="${messages# }"
    [ -n "$messages" ] && printf '{"systemMessage":"%s"}\n' "$messages"
    exit 0
    ;;
esac

# PreToolUse.
if [ -z "$local_build" ] && ! installed; then
  if ! fail_closed; then
    # Shadow mode blocks nothing, so don't hold up the call: let the
    # download run in the background and check calls once it's done.
    recently_failed || start_background_download
    exit 0
  fi
  # Enforcing: wait up to 90 seconds for a download already running, else
  # download now, and ask if the checker still isn't there.
  i=0
  while [ "$i" -lt 90 ] && lock_owner_alive && ! installed; do
    sleep 1
    i=$((i + 1))
  done
  if ! installed; then
    recently_failed && ask "Lelu could not download its checker recently and will retry in a few minutes."
    download_release
    case $? in
      0) ;;
      2) ask "Lelu is still downloading its checker." ;;
      *) ask "$problem" ;;
    esac
  fi
fi
exec "$hook"
