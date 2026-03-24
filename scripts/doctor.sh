#!/usr/bin/env bash
set -euo pipefail

CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
SKILL_DIR="$CODEX_HOME/skills/trends-radar"
PLUGIN_DIR="${OPENCLI_HOME:-$HOME/.opencli}/plugins/google-trends-rising"
CHROME_APP_PATH="${DOCTOR_CHROME_APP_PATH:-/Applications/Google Chrome.app}"
DATA_DIR="$HOME/.codex/data/trends-radar"
CONFIG_PATH="$DATA_DIR/config.json"
INSTALL_HINT="$SKILL_DIR/scripts/install.sh"

fail() {
  echo "$1" >&2
  exit 1
}

[ "$(uname)" = "Darwin" ] || fail "macOS is required"
([ -d "$CHROME_APP_PATH" ] || command -v "Google Chrome" >/dev/null 2>&1) || fail "Google Chrome is required"
command -v node >/dev/null 2>&1 || fail "node is required"
command -v npm >/dev/null 2>&1 || fail "npm is required"
command -v opencli >/dev/null 2>&1 || fail "opencli is required"
[ -f "$SKILL_DIR/SKILL.md" ] || fail "Skill is not installed"
[ -f "$PLUGIN_DIR/package.json" ] || fail "OpenCLI plugin is not installed"
[ -d "$DATA_DIR" ] || fail "Stable data directory is missing at $DATA_DIR. Run $INSTALL_HINT to initialize it."
[ -f "$CONFIG_PATH" ] || fail "Stable config is missing or unreadable at $CONFIG_PATH. Run $INSTALL_HINT to initialize it."
node -e "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))" "$CONFIG_PATH" >/dev/null 2>&1 \
  || fail "Stable config is missing or unreadable at $CONFIG_PATH. Run $INSTALL_HINT to initialize it."

opencli google collect-open-trends-tabs --help >/dev/null 2>&1 || fail "OpenCLI collector command is not available"

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
  fail 'Apple Events probe failed. Enable "Allow JavaScript from Apple Events" in Google Chrome Developer settings, then rerun doctor.'
fi

probe_json="$(printf '%s' "$probe_json" | tr -d '[:space:]')"

case "$probe_json" in
  *'"ok":true'*)
    ;;
  *'"reason":"no_window"'*)
    fail "Open a Google Chrome window and rerun doctor."
    ;;
  *)
    fail 'Apple Events probe failed. Enable "Allow JavaScript from Apple Events" in Google Chrome Developer settings, then rerun doctor.'
    ;;
esac

echo "Doctor OK: install, plugin, and Apple Events probe all look healthy"
