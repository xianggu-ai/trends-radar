# trends-radar Skill v2 Design

## Goal

Refactor `trends-radar` from a working workflow into a more maintainable, distributable Skill product.

V2 should keep the current public entrypoint simple while improving:

- progressive disclosure through the skill file system
- stable runtime configuration and memory
- operational gotchas capture
- usage measurement
- maintainability as the workflow grows

The goal is not to add many new end-user features. The goal is to make the existing install, doctor, collect, and round-2 workflow easier to operate, evolve, and distribute.

## Design Principles

V2 follows these principles:

- keep one public Skill name: `trends-radar`
- keep the top-level Skill thin and route detailed guidance into references, assets, and scripts
- prefer scripts for deterministic work and prompts only for judgment-heavy work
- store runtime state outside the installed Skill directory
- capture real-world gotchas as first-class skill content
- avoid splitting into multiple public Skills until real usage data shows that the boundaries are stable

## Current Problems

The current repository already has a good foundation:

- an installable repo
- a packaged Skill
- scripts for install, doctor, and round-2 normalization
- an OpenCLI plugin for collection

But the current design still has these weaknesses:

- too much guidance remains concentrated in the main `SKILL.md`
- there is no formal `references/` or `assets/` layer for progressive disclosure
- there is no stable config or usage log outside the installed Skill directory
- runtime learning from failures is implicit rather than captured in a formal gotchas resource
- install, doctor, collect, and round-2 all live behind one public Skill without enough internal modularization

## V2 Repository Shape

V2 should keep a single public repo and a single public Skill, but reorganize the Skill internals to use the file system intentionally.

Recommended structure:

```text
trends-radar/
├── README.md
├── skills/
│   └── trends-radar/
│       ├── SKILL.md
│       ├── references/
│       │   ├── install.md
│       │   ├── collect.md
│       │   ├── round2.md
│       │   ├── gotchas.md
│       │   └── runbook.md
│       ├── assets/
│       │   ├── keep.example.json
│       │   ├── reject.example.json
│       │   └── config.example.json
│       └── scripts/
│           ├── doctor.sh
│           ├── install.sh
│           ├── round2-prepare.mjs
│           ├── init-config.mjs
│           └── log-usage.mjs
├── plugin/
│   └── opencli-plugin-google-trends-rising/
├── evals/
└── tests/
```

Notes:

- `SKILL.md` remains the entrypoint and trigger definition.
- `references/` holds detailed workflow rules and operational knowledge.
- `assets/` holds output examples and config examples.
- `scripts/` holds deterministic helpers that the Skill can call.
- the existing plugin remains vendored in the repo and continues to power first-stage collection.

## Public Skill Boundary

V2 should still expose only one public Skill:

- `trends-radar`

That public Skill should continue to support the same user-facing actions:

- `install`
- `doctor`
- `collect`
- `round2`

V2 should not immediately split these into separate public Skills.

Reasoning:

- the workflow is still young
- premature splitting would increase discovery and curation overhead
- the main issue is internal modularity, not external naming

Future multi-Skill splitting is allowed later if usage data clearly shows stable boundaries such as:

- `trends-radar-ops`
- `trends-radar-collect`
- `trends-radar-round2`

But that is explicitly out of scope for V2.

## SKILL.md Responsibilities

In V2, the top-level `SKILL.md` should become thinner.

It should contain only:

- trigger policy
- the high-level state machine
- which action to run next
- which reference or script to use for the selected action

It should avoid holding long, detailed procedural content that belongs in referenced files.

The description field should stay explicit-trigger-only, but it should better describe what the Skill is for, not just its packaging model.

Example direction:

- Google Trends workflow for manually prepared Chrome tabs on macOS
- supports install, doctor, collection, and round-2 filtering
- use only when the user explicitly names `trends-radar`

## references/ Responsibilities

The new `references/` layer should carry detailed content that is currently either packed into the main Skill or missing entirely.

### install.md

Should contain:

- fresh-machine bootstrap path
- installed repair path
- upgrade path
- expected locations after install

### collect.md

Should contain:

- Google Trends compare-tab preparation rules
- scope consistency requirements
- merge and dedupe semantics
- expectations for manual CAPTCHA handling
- collector limitations and known assumptions

### round2.md

Should contain:

- round-2 keep/reject contract
- live context budget limits
- output schema guidance
- examples of good keep vs reject reasoning

### gotchas.md

This is the highest-priority new reference file.

It should accumulate real observed failure cases such as:

- OpenCLI daemon or bridge instability
- Chrome Apple Events JavaScript disabled
- mismatched compare-tab scope
- CAPTCHA or unusual-traffic interstitials
- live extractor DOM drift
- repeated seed overlap and result-merge confusion
- round-2 false positives and false negatives

This file should be built from real failure reports rather than hypothetical advice.

### runbook.md

Should contain symptom-to-action mapping for common failures:

- install problems
- doctor failures
- collection failures
- extractor failures
- round-2 input/output problems

## assets/ Responsibilities

V2 should add example assets so the Skill does not need to restate output shapes from scratch.

Recommended assets:

- `keep.example.json`
- `reject.example.json`
- `config.example.json`

These assets should be short, readable, and close to real expected output.

## Stable Runtime Data

V2 should define a stable runtime data directory outside the installed Skill directory.

Recommended default:

```text
~/.codex/data/trends-radar/
```

Recommended contents:

```text
~/.codex/data/trends-radar/
├── config.json
├── usage.jsonl
├── round2-decisions.jsonl
└── runs/
```

Why this is needed:

- the installed Skill directory may be replaced during upgrade or repair
- runtime memory should survive installation refreshes
- config, logs, and reusable state should not be treated as source-controlled assets

## Config

V2 should add a lightweight `config.json` stored in the stable runtime directory.

This config should hold defaults that are currently either implicit or repeated in prompts.

Suggested fields:

- `default_geo`
- `default_time`
- `default_min_rise`
- `default_output_format`
- optional per-user workflow preferences for round 2

If config is missing, the Skill may ask the user for missing setup information and then initialize the file.

V2 does not need a large settings system. It only needs enough structure to avoid repeatedly asking for stable preferences.

## Usage Logging

V2 should add lightweight Skill-level usage logging.

Logging should be simple and append-only. A JSONL file is enough.

Suggested log record fields:

- timestamp
- action (`install`, `doctor`, `collect`, `round2`)
- success or failure
- failure reason if present
- optional counts such as kept/rejected totals for round 2

This enables:

- identifying the most failure-prone step
- understanding real usage patterns
- deciding later whether the Skill is undertriggering or over-centralized

V2 does not require a sophisticated telemetry system.

## Script Additions

V2 should keep existing scripts and add a minimal set of new helpers.

Recommended additions:

- `init-config.mjs`
  - creates or updates stable `config.json`
- `log-usage.mjs`
  - appends structured records into `usage.jsonl`

Existing scripts should remain the main deterministic entrypoints:

- `install.sh`
- `doctor.sh`
- `round2-prepare.mjs`

If future round-2 helpers become stable enough to script, they should be added here rather than bloating the main Skill instructions.

## Composition

V2 should be written so the public Skill can reference other useful skills when available, but without hard dependency on them.

Examples:

- use a browser verification Skill when extractor troubleshooting needs visible browser evidence
- use a skill installer flow only when repair or bootstrap context requires it

This composition should stay optional. V2 should still work as a self-contained package.

## Distribution and Curation

V2 should keep the current standalone repo distribution model.

Why this is the right model now:

- the Skill is reusable across multiple repos and machines
- shipping it as a separate repo reduces unrelated model context in product repos
- it supports explicit install, upgrade, and repair flows

However, V2 should treat the project as curated and still evolving.

Implications:

- keep known limitations clearly documented
- avoid broadening the Skill before the live extractor is fully validated
- prefer measured improvement over fast Skill proliferation

## Non-Goals

V2 does not include:

- splitting into many public Skills immediately
- building a large database-backed memory layer
- adding always-on hooks
- creating a marketplace-specific publishing workflow
- solving the live extractor correctness problem inside this design doc

Those may be revisited later, but they are not part of V2.

## Success Criteria

V2 is successful when:

1. the public Skill remains easy to discover and invoke
2. the main `SKILL.md` becomes materially shorter and more focused
3. install, doctor, collect, and round-2 details are pushed into references, assets, and scripts
4. runtime config and logs survive upgrades
5. real gotchas are captured in a dedicated resource
6. future changes can be made by editing the correct layer instead of overloading the top-level Skill

## Rollout Order

Recommended implementation order:

1. add `references/` and move detailed guidance out of the top-level Skill
2. add `assets/` for config and output examples
3. add stable runtime data directory support
4. add lightweight config initialization
5. add usage logging
6. tighten docs and evals around the new structure

This order improves maintainability first, then adds stable memory and measurement.
