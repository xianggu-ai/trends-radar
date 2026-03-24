# trends-radar

This repo ships a custom OpenCLI plugin plus a Codex Skill for collecting Google Trends `Related queries > Rising` data from tabs that are already open in desktop Google Chrome on macOS. `opencli` is the host runtime, but `collect-open-trends-tabs` is provided by this repository's custom OpenCLI plugin, not by upstream OpenCLI.

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

- run ~/.codex/skills/trends-radar/scripts/doctor.sh
- invoke the installed Skill explicitly by name: `使用 trends-radar`

## Upgrade

Use the same installer for upgrades and routine refreshes:

```bash
git pull
./scripts/install.sh
```

This refreshes the installed Skill bundle under `~/.codex/skills/trends-radar/` and the runtime plugin under `~/.opencli/plugins/google-trends-rising/`.

## Collection Prep

- Open the Google Trends compare pages you want to collect in desktop Google Chrome.
- Keep every collection tab on the same geo, time, category, and search property.
- Leave each page on a Google Trends `explore` result, not the Trends home page.
- Allow macOS Automation permission if Terminal or Codex prompts to control Google Chrome.
- In Chrome, enable `View -> Developer -> Allow JavaScript from Apple Events`.
- resolve any CAPTCHA or unusual-traffic interstitial manually
- After doctor passes, run `opencli google collect-open-trends-tabs --min-rise 2000 -f json`.

## Troubleshooting

- Installed health check: run `~/.codex/skills/trends-radar/scripts/doctor.sh` whenever the workflow looks unhealthy or before the first collection attempt on a machine.
- Installed repair: run `~/.codex/skills/trends-radar/scripts/install.sh` if the installed Skill or plugin is missing, stale, or damaged.
- If doctor reports an Apple Events failure, enable Chrome's `Allow JavaScript from Apple Events` setting and rerun doctor.
- If collection fails after doctor passes, re-check browser prep: same geo, time, category, and search property, valid Google Trends compare pages, and any manual CAPTCHA clearance.
- If extraction still fails on a correctly prepared page, treat that as a collector limitation and update the vendored plugin before relying on the result.
