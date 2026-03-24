---
name: trends-radar
description: Explicit-trigger-only workflow for the packaged Google Trends rising collector Skill and custom OpenCLI plugin.
---

# trends-radar

Use this skill only when the user explicitly names `trends-radar`. Do not auto-trigger from generic Google Trends requests.
If the user asks a generic Google Trends question without explicitly naming `trends-radar`, do not use this skill.

Trigger examples:
- `使用 trends-radar`
- `使用 trends-radar 做体检`
- `使用 trends-radar 安装`
- `使用 trends-radar 采集 Google Trends`
- `使用 trends-radar 做二轮筛选`

## Actions

- `install`
- `doctor`
- `collect`
- `round2`

## State-Driven Workflow

1. On a fresh machine, install happens from README.md plus scripts/install.sh.
2. If the plugin is missing or damaged on an already-installed machine, run `${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/install.sh`.
3. If the installed workflow looks unhealthy, run `${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/doctor.sh`.
4. If doctor fails, stop.
5. Before `collect`, require every prepared Google Trends compare tab to use the same geo, time, category, and search property.
6. Resolve any CAPTCHA or unusual-traffic interstitial manually.
7. After doctor passes, run or guide `opencli google collect-open-trends-tabs --min-rise 2000 -f json`.
8. If the user explicitly asks for round 2, require a first-stage JSON file path and run `node ${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/round2-prepare.mjs /path/to/round1.json`.
9. If collection or round 2 fails, map the failure to environment remediation, install remediation, or collection remediation before trying again.

## install

- Fresh machine: direct the user to the repository README bootstrap flow and `./scripts/install.sh`. The Skill is not the first-install entrypoint.
- Already installed but damaged: use `${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/install.sh` to repair the installed Skill bundle and the custom OpenCLI plugin.
- If installed repair fails, keep the user in install/repair mode and do not proceed to collection.

## doctor

- Run `${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/doctor.sh` before any collection attempt.
- Doctor confirms the packaged macOS workflow: Chrome, `node`, `npm`, `opencli`, the installed plugin, and Apple Events JavaScript execution.
- If doctor reports that Chrome cannot execute JavaScript from Apple Events, tell the user to enable Chrome's Developer setting for JavaScript from Apple Events, then rerun doctor.
- If doctor fails, stop.

## collect

- Only continue after doctor passes.
- Confirm the user has prepared Google Trends compare tabs in desktop Chrome.
- Require the same geo, time, category, and search property across every tab to be collected.
- Resolve any CAPTCHA or unusual-traffic interstitial manually.
- Run `opencli google collect-open-trends-tabs --min-rise 2000 -f json` or guide the user to run it.

## round2

- Only continue when the user explicitly asks for round 2, for example `使用 trends-radar 做二轮筛选`.
- Ask only for the first-stage JSON path if it is missing.
- Run `node ${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/round2-prepare.mjs /path/to/round1.json`.
- Use the helper output to get the normalized candidates plus output paths.
- Use each candidate's `source_context` as the first-stage context input for round-2 judgment.
- If the helper returns no candidates, write `[]` to both output files and tell the user no candidates were available for round 2.
- Write bare-array JSON outputs to the helper-provided `keepPath` and `rejectPath`.
- Keep output fields:
  - `keyword`
  - `seeds`
  - `rise_pct`
  - `site_type`
  - `why`
  - `evidence`
- Reject output fields:
  - `keyword`
  - `seeds`
  - `reject_reason`
  - `why`
- Allowed `site_type` values:
  - `tool`
  - `game`
  - `content`
  - `mixed`
- Allowed `reject_reason` values:
  - `short_term_event`
  - `noise`
  - `not_siteable`
  - `too_broad`
  - `navigational`
- Use lightweight live context with a hard cap of three evidence items per kept keyword.
- If live context is unavailable, continue with first-stage context only and include one short fallback note inside the kept row's `evidence` array.

## Failure Mapping

- Environment remediation: wrong OS, Chrome missing, `opencli` missing, or Apple Events JavaScript not working. Send the user back to `doctor`.
- Install remediation: the packaged plugin or Skill is missing or corrupted. Rerun `${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/install.sh`, then rerun doctor.
- Collection remediation: no valid Trends tabs, mismatched scope, blocked pages, extraction failure, or round-2 input/output issues. Fix browser state or JSON input, then rerun the relevant command.
