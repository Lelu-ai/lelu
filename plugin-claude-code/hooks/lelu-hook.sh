#!/bin/sh
# Lelu hook launcher for Claude Code.
#
# hooks.json runs this script. It makes sure the lelu-hook and lelu-daemon
# programs for this plugin version are installed, then passes the hook input
# (stdin) to lelu-hook, which asks the local daemon for a decision.
#
# Why a download: lelu-hook and lelu-daemon are compiled Go programs, too
# large to keep in the plugin folder. The release workflow
# (.github/workflows/plugin-claude-code-release.yml) builds them from
# plugin-claude-code/daemon and publishes them on the GitHub release
# plugin-claude-code-v$LELU_PLUGIN_VERSION. On first use this script
# downloads the two files for this OS and CPU from that release, checks each
# against the release's SHA256SUMS.txt, and installs them under
# $data_dir/bin/$LELU_PLUGIN_VERSION, where plugin updates don't remove them.
#
# Network: only github.com and release-assets.githubusercontent.com, only
# over HTTPS, only those three files, only until the install succeeds.
# Nothing is uploaded and no data about your session is sent.
#
# Usage:
#   lelu-hook.sh           PreToolUse: install if needed, then run lelu-hook
#   lelu-hook.sh install   SessionStart: install if needed, and check that
#                          the plugin's own files are unchanged; silent when
#                          all is well
#
# If Lelu cannot check an action (for example, the download failed), the
# call is left to Claude Code's own permission flow in shadow mode, and
# routed to "ask" in enforce mode, so stopping Lelu does not get an action
# past it once blocking is on. LELU_FAIL_CLOSED=1 or =0 overrides this, as it
# does in lelu-hook.
#
# A local build wins: if install.sh has built hooks/lelu-hook and
# bin/lelu-daemon inside the plugin folder, those are used and nothing is
# downloaded.

set -u

LELU_PLUGIN_VERSION="0.2.1"
REPO="Lelu-ai/lelu"

mode="${1:-hook}"
plugin_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
data_dir="${LELU_DATA_DIR:-${LELU_HOME:-$HOME/.lelu/claude-plugin}}"
bin_dir="$data_dir/bin/$LELU_PLUGIN_VERSION"

# fail_closed is true when an action Lelu cannot check should be routed to
# "ask": LELU_FAIL_CLOSED decides if set, otherwise enforce mode does.
fail_closed() {
  case "${LELU_FAIL_CLOSED:-}" in
    1 | true) return 0 ;;
    0 | false) return 1 ;;
  esac
  [ "$(cat "$data_dir/mode" 2>/dev/null)" = "enforce" ]
}

# warn reports that Lelu cannot check actions. The text is shown to the user
# and, for a tool call, to the model; in enforce mode the call is also routed
# to "ask" (see fail_closed). Messages are fixed text with no double quotes or
# backslashes, so they need no JSON escaping.
warn() {
  if [ "$mode" = "install" ]; then
    printf '{"systemMessage":"%s"}\n' "$1"
  elif fail_closed; then
    printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"Lelu could not check this action, and it is enforcing, so it needs your approval: %s"}}\n' "$1" "$1"
  else
    printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"%s"}}\n' "$1" "$1"
  fi
  exit 0
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
# downloading. take_lock creates it; lock_owner_alive tells whether that
# process still exists; clear_lock removes it.
take_lock() {
  mkdir "$lock" 2>/dev/null && echo "$$" >"$lock/pid"
}

lock_owner_alive() {
  [ -d "$lock" ] || return 1
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

# remove_tmp deletes this download's temporary directory and its files.
remove_tmp() {
  rm -f "$1/SHA256SUMS.txt" "$1/lelu-daemon" "$1/lelu-hook"
  rmdir "$1" 2>/dev/null
}

install_release() {
  case "$(uname -s)" in
    Linux) os=linux ;;
    Darwin) os=darwin ;;
    *) warn "Lelu has no prebuilt binaries for this OS, so Lelu is not checking actions. Build them with plugin-claude-code/install.sh." ;;
  esac
  case "$(uname -m)" in
    x86_64 | amd64) arch=amd64 ;;
    arm64 | aarch64) arch=arm64 ;;
    *) warn "Lelu has no prebuilt binaries for this CPU, so Lelu is not checking actions. Build them with plugin-claude-code/install.sh." ;;
  esac

  mkdir -p "$data_dir/bin" || warn "Lelu could not create its data directory, so Lelu is not checking actions."

  # After a failed download, wait 10 minutes before trying again, so an
  # offline machine does not retry on every tool call.
  failed="$data_dir/bin/.download-$LELU_PLUGIN_VERSION.failed"
  if [ -f "$failed" ] && [ -n "$(find "$failed" -mmin -10 2>/dev/null)" ]; then
    warn "Lelu could not download its binaries recently and will retry in a few minutes, so Lelu is not checking actions."
  fi

  # One download at a time: SessionStart and the first tool call can overlap.
  # A lock whose process is gone (for example, one stopped by the hook
  # timeout) is cleared at once. One older than 30 minutes is cleared anyway,
  # in case its PID was reused.
  lock="$data_dir/bin/.download-$LELU_PLUGIN_VERSION.lock"
  if [ -d "$lock" ] && { ! lock_owner_alive || [ -n "$(find "$lock" -maxdepth 0 -mmin +30 2>/dev/null)" ]; }; then
    clear_lock
  fi
  if ! take_lock; then
    # Another process is downloading: wait up to 90 seconds for it, and take
    # over if it dies.
    i=0
    while [ "$i" -lt 90 ]; do
      [ -x "$bin_dir/lelu-hook" ] && [ -x "$bin_dir/lelu-daemon" ] && return 0
      if ! lock_owner_alive; then
        clear_lock
        take_lock && break
      fi
      sleep 1
      i=$((i + 1))
    done
    [ "$i" -lt 90 ] || warn "Lelu is still downloading its binaries, so Lelu is not checking actions."
  fi

  # Holding the lock: remove what an interrupted download left behind.
  for old in "$data_dir/bin"/.tmp.*; do
    [ -d "$old" ] && remove_tmp "$old"
  done

  tmp=$(mktemp -d "$data_dir/bin/.tmp.XXXXXX") || { clear_lock; warn "Lelu could not create a temporary directory, so Lelu is not checking actions."; }
  trap 'remove_tmp "$tmp"; clear_lock; exit 1' INT TERM HUP
  base="https://github.com/$REPO/releases/download/plugin-claude-code-v$LELU_PLUGIN_VERSION"
  result=ok
  if ! fetch "$base/SHA256SUMS.txt" "$tmp/SHA256SUMS.txt"; then
    result=download
  fi
  for name in lelu-daemon lelu-hook; do
    [ "$result" = ok ] || break
    asset="$name-$os-$arch"
    if ! fetch "$base/$asset" "$tmp/$name"; then
      result=download
      break
    fi
    want=$(awk -v f="$asset" '$2 == f || $2 == "*" f { print $1 }' "$tmp/SHA256SUMS.txt")
    got=$(sha256_of "$tmp/$name") || { result=nosha; break; }
    if [ -z "$want" ] || [ "$want" != "$got" ]; then
      result=checksum
      break
    fi
    chmod 755 "$tmp/$name"
  done

  if [ "$result" = ok ]; then
    mkdir -p "$bin_dir" &&
      mv "$tmp/lelu-daemon" "$bin_dir/lelu-daemon" &&
      mv "$tmp/lelu-hook" "$bin_dir/lelu-hook" || result=move
  fi
  remove_tmp "$tmp"
  clear_lock
  trap - INT TERM HUP

  case "$result" in
    ok) rm -f "$failed"; return 0 ;;
    checksum) touch "$failed"; warn "Lelu downloaded binaries that did not match the release checksums and did not install them, so Lelu is not checking actions." ;;
    nosha) warn "Lelu needs sha256sum or shasum to check its downloaded binaries, so Lelu is not checking actions." ;;
    move) warn "Lelu could not install its binaries into its data directory, so Lelu is not checking actions." ;;
    *) touch "$failed"; warn "Lelu could not download its binaries from GitHub (curl or wget and network access are needed), so Lelu is not checking actions." ;;
  esac
}

# check_plugin_files warns at session start if the plugin's own files have
# changed since this plugin version first ran on this machine: an edited
# hooks.json, launcher or default policy can switch Lelu off or loosen it.
# The first run records the hashes; later runs compare. It only warns, and
# cannot catch an edit that also removes this check, so it is a tripwire,
# not a lock.
check_plugin_files() {
  record="$data_dir/plugin-files-$LELU_PLUGIN_VERSION.sha256"
  current=""
  for f in hooks/hooks.json hooks/lelu-hook.sh policies/defaults.json; do
    h=$(sha256_of "$plugin_root/$f") || return 0
    current="$current$h  $f
"
  done
  if [ ! -f "$record" ]; then
    printf '%s' "$current" >"$record"
    return 0
  fi
  if [ "$(cat "$record")" != "$(printf '%s' "$current")" ]; then
    printf '{"systemMessage":"%s"}\n' "Lelu: its own plugin files (hooks.json, lelu-hook.sh or policies/defaults.json) have changed since this version was installed. If you did not change them, reinstall the plugin. To accept the change, delete plugin-files-$LELU_PLUGIN_VERSION.sha256 in the Lelu data directory."
  fi
}

local_build=""
if [ -x "$plugin_root/hooks/lelu-hook" ] && [ -x "$plugin_root/bin/lelu-daemon" ]; then
  # Local build from install.sh. lelu-hook finds the daemon through
  # CLAUDE_PLUGIN_ROOT, which Claude Code sets.
  local_build=1
  hook="$plugin_root/hooks/lelu-hook"
else
  if [ ! -x "$bin_dir/lelu-hook" ] || [ ! -x "$bin_dir/lelu-daemon" ]; then
    install_release
  fi
  hook="$bin_dir/lelu-hook"
  LELU_DAEMON_BIN="$bin_dir/lelu-daemon"
  export LELU_DAEMON_BIN
fi

if [ "$mode" = "install" ]; then
  # A local build is being edited on purpose, so it is not checked.
  [ -n "$local_build" ] || check_plugin_files
  exit 0
fi
exec "$hook"
