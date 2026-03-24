# trends-radar

This repo ships a custom OpenCLI plugin plus a Codex Skill for collecting Google Trends `Related queries > Rising` data from tabs that are already open in desktop Google Chrome on macOS. `opencli` is the host runtime, but `collect-open-trends-tabs` is provided by this repository's custom OpenCLI plugin, not by upstream OpenCLI.

The public Skill name remains `trends-radar`.
Detailed workflow rules and operational gotchas live under `skills/trends-radar/references/`.
Example config and round-2 payloads live under `skills/trends-radar/assets/`.
The installer copies those resources into the installed Skill bundle as well.
Stable runtime data lives under `~/.codex/data/trends-radar/`.
That directory keeps durable files such as `config.json` and the append-only `usage.jsonl`.
This runtime memory survives upgrades because `./scripts/install.sh` refreshes the installed bundle separately from the stable data directory.

## Current Status

- Packaging, install, doctor, and Skill workflow are implemented and tested.
- The live Google Trends DOM extractor still needs final validation against a real prepared Trends page before this collector should be treated as production-ready.

## Bootstrap

Fresh-machine prerequisites before running the installer:

- macOS
- desktop Google Chrome
- `node`
- `npm`
- `opencli`

Use this flow on a fresh machine that does not already have the installed Skill bundle:

```bash
git clone https://github.com/xianggu-ai/trends-radar.git
cd trends-radar
./scripts/install.sh
```

After install:

- run `${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/doctor.sh`
- invoke the installed Skill explicitly by name: `使用 trends-radar`

## Upgrade

Use the same installer for upgrades and routine refreshes:

```bash
git pull
./scripts/install.sh
```

This refreshes the installed Skill bundle under `${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/` and the runtime plugin under `${OPENCLI_HOME:-$HOME/.opencli}/plugins/google-trends-rising/`.

## Collection Prep

- Open the Google Trends compare pages you want to collect in desktop Google Chrome.
- Keep every collection tab on the same geo, time, category, and search property.
- Leave each page on a Google Trends `explore` result, not the Trends home page.
- Allow macOS Automation permission if Terminal or Codex prompts to control Google Chrome.
- In Chrome, enable `View -> Developer -> Allow JavaScript from Apple Events`.
- resolve any CAPTCHA or unusual-traffic interstitial manually
- After doctor passes, run `opencli google collect-open-trends-tabs --min-rise 2000 -f json`.

## Round 2

Round 2 is a Codex Skill step, not an OpenCLI command.

Use it after round 1 has already produced a JSON file:

Start from the round 1 collector command:

```bash
opencli google collect-open-trends-tabs --min-rise 2000 -f json
```

Then run round 2 through the Skill:

```text
使用 trends-radar 做二轮筛选，输入文件是 /path/to/round1.json
```

The installed Skill uses:

```bash
node ${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/round2-prepare.mjs /path/to/round1.json
```

Round 2 writes two files next to the input:

- `round1.keep.json`
- `round1.reject.json`

If the first-stage JSON is valid but has no candidates, round 2 writes `[]` to both output files and tells you no candidates were available for round 2.

## Troubleshooting

- Installed health check: run `${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/doctor.sh` whenever the workflow looks unhealthy or before the first collection attempt on a machine.
- Installed repair: run `${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/install.sh` if the installed Skill or plugin is missing, stale, or damaged.
- If doctor reports an Apple Events failure, enable Chrome's `Allow JavaScript from Apple Events` setting and rerun doctor.
- If collection fails after doctor passes, re-check browser prep: same geo, time, category, and search property, valid Google Trends compare pages, and any manual CAPTCHA clearance.
- If extraction still fails on a correctly prepared page, treat that as a collector limitation and update the vendored plugin before relying on the result.
- If round 2 fails, verify the first-stage JSON path, rerun `node ${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/round2-prepare.mjs /path/to/round1.json`, and confirm the installed Skill bundle is current.
