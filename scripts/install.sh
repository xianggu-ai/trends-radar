#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_DIR="${SCRIPT_PATH%/*}"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
OPENCLI_HOME="${OPENCLI_HOME:-$HOME/.opencli}"
SKILL_DIR="$CODEX_HOME/skills/trends-radar"
PLUGIN_DIR="$OPENCLI_HOME/plugins/google-trends-rising"

die() {
  echo "$*" >&2
  exit 1
}

canonical_path() {
  local target="$1"

  if [ -d "$target" ]; then
    (
      cd "$target"
      pwd -P
    )
    return
  fi

  printf '%s/%s\n' "$(cd "${target%/*}" && pwd -P)" "${target##*/}"
}

parent_dir() {
  local target="$1"

  if [ "$target" = "${target%/*}" ]; then
    printf '.\n'
    return
  fi

  printf '%s\n' "${target%/*}"
}

copy_if_needed() {
  local src="$1"
  local dest="$2"

  if [ "$(canonical_path "$src")" = "$(canonical_path "$dest")" ]; then
    return
  fi

  mkdir -p "$(parent_dir "$dest")"
  cp -f "$src" "$dest"
}

sync_dir_if_needed() {
  local src="$1"
  local dest="$2"

  if [ "$(canonical_path "$src")" = "$(canonical_path "$dest")" ]; then
    return
  fi

  if command -v rsync >/dev/null 2>&1; then
    mkdir -p "$dest"
    rsync -a --delete "$src"/ "$dest"/
    return
  fi

  mkdir -p "$(parent_dir "$dest")"
  rm -rf "$dest"
  cp -R "$src" "$dest"
}

require_command() {
  local name="$1"

  if ! command -v "$name" >/dev/null 2>&1; then
    die "Missing required command: $name"
  fi
}

if [ "$(uname)" != "Darwin" ]; then
  die "This installer only supports macOS."
fi

require_command node
require_command npm
require_command opencli

if [ ! -d "/Applications/Google Chrome.app" ] && ! command -v "Google Chrome" >/dev/null 2>&1; then
  die "Google Chrome is required."
fi

if [ -f "$ROOT/skills/trends-radar/SKILL.md" ]; then
  SKILL_SOURCE_FILE="$ROOT/skills/trends-radar/SKILL.md"
elif [ -f "$ROOT/SKILL.md" ]; then
  SKILL_SOURCE_FILE="$ROOT/SKILL.md"
else
  die "Could not find SKILL.md in repo or installed layout."
fi

if [ -d "$ROOT/plugin/opencli-plugin-google-trends-rising" ]; then
  PLUGIN_SOURCE_DIR="$ROOT/plugin/opencli-plugin-google-trends-rising"
elif [ -d "$ROOT/vendor/opencli-plugin-google-trends-rising" ]; then
  PLUGIN_SOURCE_DIR="$ROOT/vendor/opencli-plugin-google-trends-rising"
else
  die "Could not find the Google Trends plugin source."
fi

VERSION_SOURCE_FILE="$ROOT/VERSION"
INSTALL_SOURCE_FILE="$ROOT/scripts/install.sh"
DOCTOR_SOURCE_FILE="$ROOT/scripts/doctor.sh"
ROUND2_HELPER_SOURCE_FILE="$ROOT/scripts/round2-prepare.mjs"

[ -f "$VERSION_SOURCE_FILE" ] || die "Could not find VERSION."
[ -f "$INSTALL_SOURCE_FILE" ] || die "Could not find install.sh."
[ -f "$DOCTOR_SOURCE_FILE" ] || die "Could not find doctor.sh."
[ -f "$ROUND2_HELPER_SOURCE_FILE" ] || die "Could not find round2-prepare.mjs."

mkdir -p "$SKILL_DIR/scripts" "$SKILL_DIR/vendor" "$PLUGIN_DIR"

copy_if_needed "$SKILL_SOURCE_FILE" "$SKILL_DIR/SKILL.md"
copy_if_needed "$VERSION_SOURCE_FILE" "$SKILL_DIR/VERSION"
copy_if_needed "$INSTALL_SOURCE_FILE" "$SKILL_DIR/scripts/install.sh"
copy_if_needed "$DOCTOR_SOURCE_FILE" "$SKILL_DIR/scripts/doctor.sh"
copy_if_needed "$ROUND2_HELPER_SOURCE_FILE" "$SKILL_DIR/scripts/round2-prepare.mjs"
chmod +x "$INSTALL_SOURCE_FILE" "$SKILL_DIR/scripts/install.sh" "$DOCTOR_SOURCE_FILE" "$SKILL_DIR/scripts/doctor.sh" "$ROUND2_HELPER_SOURCE_FILE" "$SKILL_DIR/scripts/round2-prepare.mjs"

sync_dir_if_needed "$PLUGIN_SOURCE_DIR" "$SKILL_DIR/vendor/opencli-plugin-google-trends-rising"
sync_dir_if_needed "$PLUGIN_SOURCE_DIR" "$PLUGIN_DIR"

if [ "${GOOGLE_TRENDS_SKIP_PLUGIN_BUILD:-0}" != "1" ]; then
  (
    cd "$PLUGIN_DIR"
    npm install
    npm run build
  )
fi

printf 'Installed skill path: %s\n' "$SKILL_DIR"
printf 'Installed plugin path: %s\n' "$PLUGIN_DIR"
printf 'Next step: run the doctor workflow before collecting.\n'
