---
name: google-trends-rising-collector
description: Explicit-trigger-only workflow for the packaged Google Trends rising collector Skill and custom OpenCLI plugin.
---

# google-trends-rising-collector

Use this skill only when the user explicitly names `google-trends-rising-collector`. Do not auto-trigger from generic Google Trends requests.
If the user asks a generic Google Trends question without explicitly naming `google-trends-rising-collector`, do not use this skill.

Trigger examples:
- `使用 google-trends-rising-collector`
- `使用 google-trends-rising-collector 做体检`
- `使用 google-trends-rising-collector 安装`
- `使用 google-trends-rising-collector 采集 Google Trends`

## Actions

- `install`
- `doctor`
- `collect`

## State-Driven Workflow

1. On a fresh machine, install happens from README.md plus scripts/install.sh.
2. If the plugin is missing or damaged on an already-installed machine, run `${CODEX_HOME:-$HOME/.codex}/skills/google-trends-rising-collector/scripts/install.sh`.
3. If the installed workflow looks unhealthy, run `${CODEX_HOME:-$HOME/.codex}/skills/google-trends-rising-collector/scripts/doctor.sh`.
4. If doctor fails, stop.
5. Before `collect`, require every prepared Google Trends compare tab to use the same geo, time, category, and search property.
6. Resolve any CAPTCHA or unusual-traffic interstitial manually.
7. After doctor passes, run or guide `opencli google collect-open-trends-tabs --min-rise 2000 -f json`.
8. If collection fails, map the failure to environment remediation, install remediation, or collection remediation before trying again.

## install

- Fresh machine: direct the user to the repository README bootstrap flow and `./scripts/install.sh`. The Skill is not the first-install entrypoint.
- Already installed but damaged: use `${CODEX_HOME:-$HOME/.codex}/skills/google-trends-rising-collector/scripts/install.sh` to repair the installed Skill bundle and the custom OpenCLI plugin.
- If installed repair fails, keep the user in install/repair mode and do not proceed to collection.

## doctor

- Run `${CODEX_HOME:-$HOME/.codex}/skills/google-trends-rising-collector/scripts/doctor.sh` before any collection attempt.
- Doctor confirms the packaged macOS workflow: Chrome, `node`, `npm`, `opencli`, the installed plugin, and Apple Events JavaScript execution.
- If doctor reports that Chrome cannot execute JavaScript from Apple Events, tell the user to enable Chrome's Developer setting for JavaScript from Apple Events, then rerun doctor.
- If doctor fails, stop.

## collect

- Only continue after doctor passes.
- Confirm the user has prepared Google Trends compare tabs in desktop Chrome.
- Require the same geo, time, category, and search property across every tab to be collected.
- Resolve any CAPTCHA or unusual-traffic interstitial manually.
- Run `opencli google collect-open-trends-tabs --min-rise 2000 -f json` or guide the user to run it.

## Failure Mapping

- Environment remediation: wrong OS, Chrome missing, `opencli` missing, or Apple Events JavaScript not working. Send the user back to `doctor`.
- Install remediation: the packaged plugin or Skill is missing or corrupted. Rerun `${CODEX_HOME:-$HOME/.codex}/skills/google-trends-rising-collector/scripts/install.sh`, then rerun doctor.
- Collection remediation: no valid Trends tabs, mismatched scope, blocked pages, or extraction failure. Fix browser state, then rerun the collector command.
