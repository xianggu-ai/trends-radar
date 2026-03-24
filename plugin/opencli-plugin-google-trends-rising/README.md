# opencli-plugin-google-trends-rising

Standalone OpenCLI plugin for collecting Google Trends `Related queries > Rising`
data from Google Trends compare tabs that are already open in Google Chrome on macOS.

## Local install

If this project lives at `/Users/harris/codex-workspace/.worktrees/google-trends-related-rising/projects/opencli-plugin-google-trends-rising`:

```bash
cd /Users/harris/codex-workspace/.worktrees/google-trends-related-rising/projects/opencli-plugin-google-trends-rising
npm install
npm run build
OPENCLI_PLUGIN_DIR="${OPENCLI_HOME:-$HOME/.opencli}/plugins/google-trends-rising"
mkdir -p "$OPENCLI_PLUGIN_DIR"
rsync -a --delete /Users/harris/codex-workspace/.worktrees/google-trends-related-rising/projects/opencli-plugin-google-trends-rising/ "$OPENCLI_PLUGIN_DIR"/
opencli list | rg "collect-open-trends-tabs"
```

Why sync instead of symlink:

- current `opencli` plugin discovery scans real subdirectories under `${OPENCLI_HOME:-$HOME/.opencli}/plugins/`
- a symlink at the plugin directory level is skipped by discovery

## Usage

1. Open Google Trends compare pages manually in Google Chrome on macOS.
2. Ensure every page you want to collect uses the same `geo`, `time`, `category`, and `search property`.
3. Leave the pages on Google Trends `explore` results, not the Trends home page.
4. If macOS prompts for Automation permission, allow Terminal/Codex to control Google Chrome.
5. In Chrome, enable `View` -> `Developer` -> `Allow JavaScript from Apple Events`.
6. Run:

```bash
opencli google collect-open-trends-tabs --min-rise 2000 -f json
```

## Behavior

- the command scans open Google Trends compare tabs from Chrome windows
- only `Related queries > Rising` entries above `2000%` are kept by default
- `Breakout` is always preserved
- results are merged by seed keyword
- tabs with mismatched scope are marked `mismatch_skipped`
- exact duplicate compare pages are marked `duplicate_skipped`

## Smoke verification

Expected outcomes:

- structured JSON with `run`, `results`, and `tabs` when compatible Trends pages are open
- a nonzero command failure when no canonical scope can be established from any open Trends tab
- actionable error text when macOS Automation permission for Google Chrome is missing
- actionable error text when Chrome has not enabled `Allow JavaScript from Apple Events`
