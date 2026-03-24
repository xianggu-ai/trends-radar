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

## State-Driven Workflow

1. On a fresh machine, install happens from README.md plus `./scripts/install.sh`.
2. If the installed Skill bundle or plugin is missing or damaged, run `${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/install.sh`.
3. Before any collection attempt, run `${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/doctor.sh`.
4. If doctor fails, stop.
5. After doctor passes, run or guide `opencli google collect-open-trends-tabs --min-rise 2000 -f json`.
6. If the user explicitly asks for round 2, require a first-stage JSON file path and run `node ${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/round2-prepare.mjs /path/to/round1.json`.
7. If install, doctor, collect, or round 2 fails, consult the runbook and gotchas before retrying.

## References And Assets

Read `references/install.md` for install, repair, upgrade, and installed-path details.
Read `references/collect.md` for collection preparation, scope rules, merge semantics, and CAPTCHA handling.
Read `references/round2.md` for the keep/reject contract, output schema, and live-context budget.
Read `references/gotchas.md` for observed failure modes before improvising a fix.
Read `references/runbook.md` to map symptoms to the next remediation step.
Use `assets/config.example.json` as the config shape reference.
Use `assets/keep.example.json` and `assets/reject.example.json` as round-2 output examples.

## install

- Fresh-machine bootstrap stays in README.md plus `./scripts/install.sh`.
- Installed repair uses `${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/install.sh`.
- If install repair fails, stay in install mode and do not proceed to collection.

## doctor

- Run `${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/doctor.sh` before collection.
- If doctor fails, stop.
- Use the runbook to decide whether the next step is environment remediation or install remediation.

## collect

- Only continue after doctor passes.
- Confirm the user is collecting from prepared Google Trends compare tabs in desktop Chrome.
- Run `opencli google collect-open-trends-tabs --min-rise 2000 -f json` or guide the user to run it.
- Use the collect reference for prep rules and the runbook for failures.

## round2

- Only continue when the user explicitly asks for round 2, for example `使用 trends-radar 做二轮筛选`.
- Ask only for the first-stage JSON path if it is missing.
- Run `node ${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/round2-prepare.mjs /path/to/round1.json`.
- Use the round-2 reference and example assets for the judgment contract and output shape.
