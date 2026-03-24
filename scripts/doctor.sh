#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "${SCRIPT_PATH%/*}" && pwd -P)"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
SKILL_DIR="$CODEX_HOME/skills/trends-radar"
PLUGIN_DIR="${OPENCLI_HOME:-$HOME/.opencli}/plugins/google-trends-rising"
CHROME_APP_PATH="${DOCTOR_CHROME_APP_PATH:-/Applications/Google Chrome.app}"
DATA_DIR="$HOME/.codex/data/trends-radar"
CONFIG_PATH="$DATA_DIR/config.json"
INSTALL_HINT="$SKILL_DIR/scripts/install.sh"
LOG_USAGE_SCRIPT="$SCRIPT_DIR/log-usage.mjs"

log_usage() {
  local status="$1"
  local reason="${2:-}"

  [ -f "$LOG_USAGE_SCRIPT" ] || return 0

  if [ "$status" != "ok" ] && [ ! -d "$DATA_DIR" ]; then
    return 0
  fi

  if [ -n "$reason" ]; then
    node "$LOG_USAGE_SCRIPT" doctor "$status" --reason "$reason" >/dev/null 2>&1 || true
    return
  fi

  node "$LOG_USAGE_SCRIPT" doctor "$status" >/dev/null 2>&1 || true
}

fail() {
  log_usage error "${2:-check_failed}"
  echo "$1" >&2
  exit 1
}

[ "$(uname)" = "Darwin" ] || fail "macOS is required" "unsupported_os"
([ -d "$CHROME_APP_PATH" ] || command -v "Google Chrome" >/dev/null 2>&1) || fail "Google Chrome is required" "chrome_missing"
command -v node >/dev/null 2>&1 || fail "node is required" "node_missing"
command -v npm >/dev/null 2>&1 || fail "npm is required" "npm_missing"
command -v opencli >/dev/null 2>&1 || fail "opencli is required" "opencli_missing"
[ -f "$SKILL_DIR/SKILL.md" ] || fail "Skill is not installed" "skill_missing"
[ -f "$PLUGIN_DIR/package.json" ] || fail "OpenCLI plugin is not installed" "plugin_missing"
[ -d "$DATA_DIR" ] || fail "Stable data directory is missing at $DATA_DIR. Run $INSTALL_HINT to initialize it." "data_dir_missing"
[ -f "$CONFIG_PATH" ] || fail "Stable config is missing at $CONFIG_PATH. Run $INSTALL_HINT to initialize it." "config_missing"
[ -r "$CONFIG_PATH" ] || fail "Stable config is unreadable at $CONFIG_PATH. Fix file permissions or remove it, then rerun $INSTALL_HINT." "config_unreadable"
node -e "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))" "$CONFIG_PATH" >/dev/null 2>&1 \
  || fail "Stable config is malformed at $CONFIG_PATH. Run $INSTALL_HINT to repair it." "config_malformed"

opencli google collect-open-trends-tabs --help >/dev/null 2>&1 || fail "OpenCLI collector command is not available" "collector_unavailable"

# Suppress probe stderr because the doctor contract requires the exact
# user-facing failure string below with no extra Apple Events output.
if ! probe_json="$(osascript -l JavaScript 2>/dev/null <<'EOF'
const chrome = Application('Google Chrome');
const windows = chrome.windows();

if (windows.length === 0) {
  JSON.stringify({ ok: false, reason: 'no_window' });
} else {
  try {
    const tab = windows[0].activeTab();
    tab.execute({ javascript: '1 + 1' });
    JSON.stringify({ ok: true });
  } catch (error) {
    JSON.stringify({ ok: false, reason: String(error) });
  }
}
EOF
)"; then
  fail 'Apple Events probe failed. Enable "Allow JavaScript from Apple Events" in Google Chrome Developer settings, then rerun doctor.' "apple_events_disabled"
fi

probe_json="$(printf '%s' "$probe_json" | tr -d '[:space:]')"

case "$probe_json" in
  *'"ok":true'*)
    ;;
  *'"reason":"no_window"'*)
    fail "Open a Google Chrome window and rerun doctor." "chrome_window_missing"
    ;;
  *)
    fail 'Apple Events probe failed. Enable "Allow JavaScript from Apple Events" in Google Chrome Developer settings, then rerun doctor.' "apple_events_disabled"
    ;;
esac

log_usage ok
echo "Doctor OK: install, plugin, and Apple Events probe all look healthy"
