---
name: trends-radar
description: Use only when the user explicitly names `trends-radar` for the packaged Google Trends workflow on manually prepared Chrome tabs on macOS.
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

## State Machine

1. Fresh-machine bootstrap starts from README.md plus `./scripts/install.sh`.
2. If the installed Skill bundle or plugin is missing or damaged, run `${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/install.sh`.
3. Before any collection attempt, run `${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/doctor.sh`.
4. If doctor fails, stop.
5. If doctor passes, choose exactly one next action:
   - `collect`: run or guide `opencli google collect-open-trends-tabs --min-rise 2000 -f json`
   - `round2`: run `node ${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/round2-prepare.mjs /path/to/round1.json`
6. If install, doctor, collect, or round 2 fails, consult the runbook and gotchas before retrying.

## Read Path

- `references/install.md`: install, repair, upgrade, installed-path details
- `references/collect.md`: compare-tab prep, scope rules, merge semantics, CAPTCHA handling
- `references/round2.md`: keep/reject contract, output schema, live-context budget
- `references/gotchas.md`: observed failure modes before improvising a fix
- `references/runbook.md`: verified live workflow, current limits, symptom -> remediation mapping
- `assets/config.example.json`: durable config shape
- `assets/keep.example.json` and `assets/reject.example.json`: round-2 output examples

## Stable Runtime Data

- Durable runtime data lives under `~/.codex/data/trends-radar/`.
- Use the durable `config.json` plus `assets/config.example.json` to keep setup aligned with the installed workflow.
- The installed `install` and `doctor` scripts append status records to `usage.jsonl`.

## install

- Fresh-machine bootstrap stays in README.md plus `./scripts/install.sh`.
- Installed repair uses `${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/install.sh`.
- Read `references/install.md` before improvising a new repair path.
- If install repair fails, stay in install mode and do not proceed to collection.

## doctor

- Run `${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/doctor.sh` before collection.
- Read `references/runbook.md` for the verified live prerequisites.
- If doctor fails, stop.
- Use `references/runbook.md` to decide whether the next step is environment remediation or install remediation.

## collect

- Only continue after doctor passes.
- Confirm the user is collecting from prepared Google Trends compare tabs in desktop Chrome.
- Keep the live-page preparation rules in `references/collect.md`.
- Run `opencli google collect-open-trends-tabs --min-rise 2000 -f json` or guide the user to run it.
- Use `references/gotchas.md` and `references/runbook.md` when collection output looks suspicious.

## round2

- Only continue when the user explicitly asks for round 2, for example `使用 trends-radar 做二轮筛选`.
- Ask only for the first-stage JSON path if it is missing.
- Run `node ${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/round2-prepare.mjs /path/to/round1.json`.
- Use `references/round2.md` plus the example assets for the judgment contract and output shape.
