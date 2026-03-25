# Trends Radar Soft Orchestration Design

Date: 2026-03-25

## Summary

Optimize `trends-radar` from a partially manual workflow into a softer, more repeatable execution model without turning it into a rigid one-click pipeline.

The next version should preserve agent judgment while reducing avoidable variation in file paths, action ordering, and report handoff.

## Goals

- Keep `SKILL.md` thin and state-driven.
- Add light orchestration support so different agents do not have to reconstruct the workflow from scratch each time.
- Preserve explicit human and agent judgment during collection, round 2 evaluation, and report writing.
- Avoid a fully scripted `run-all` flow that would over-constrain the agent.

## Non-Goals

- Do not turn `trends-radar` into an always-on generic Google Trends skill.
- Do not hard-code every decision into a single shell pipeline.
- Do not remove the need for live review, CAPTCHA clearance, or round 2 judgment.
- Do not fully automate Feishu publishing in this iteration.

## Current Problems

1. The execution path is split across `doctor.sh`, the OpenCLI collector, `round2-prepare.mjs`, repo references, and in-session agent judgment.
2. Another agent can collect successfully, but only if it reconstructs the workflow correctly from multiple places.
3. Report generation is not yet a first-class step in the packaged workflow.
4. The installed skill bundle and the repo workflow can drift unless the execution model is more explicit.

## Proposed Shape

### 1. Keep `SKILL.md` Thin

`SKILL.md` should continue to:

- define explicit trigger conditions
- define the high-level state machine
- point to references, assets, and scripts
- enforce hard stop conditions

It should not absorb detailed execution logic that belongs in scripts or references.

### 2. Add a Soft Orchestration Helper

Add a lightweight helper script:

- `scripts/workflow-next-step.mjs`

Its job is not to execute the whole workflow blindly.
Its job is to answer:

- what artifacts already exist
- what the likely next step is
- which command or action the agent should run next

Expected inputs:

- optional round 1 file path
- optional round 2 keep/reject paths
- optional report path

Expected outputs:

- normalized file paths
- recommended next action: `doctor`, `collect`, `round2`, `report`
- short rationale for the recommendation

This keeps the workflow stateful without being rigid.

### 3. Add a Report Helper

Add a lightweight report helper:

- `scripts/report-from-round2.mjs`

Its job is to:

- read round 1 metadata plus round 2 `keep/reject`
- generate a conclusion-first markdown report scaffold
- preserve room for agent-authored reasoning, evidence, and curation

The helper should not decide which keywords to keep.
It should format the output once that judgment already exists.

### 4. Encode Hard Rules vs Soft Rules

The references should explicitly separate:

- hard rules
  - doctor must pass before collection
  - same scope across compare tabs
  - manual CAPTCHA clearance remains required
  - round 1 must exist before round 2
- soft rules
  - how many keywords to keep
  - how aggressively to reject borderline brand terms
  - how much live context to gather
  - how much detail to include in the report

This keeps the workflow disciplined without over-railroading the agent.

## References Changes

Update references so they reflect the softer execution model:

- `references/runbook.md`
  - add explicit route from `collect` to `round2` to `report`
- `references/round2.md`
  - clarify that the helper prepares inputs, but the agent still owns judgment
- `references/gotchas.md`
  - add a reminder that over-automation can create false confidence

## README Changes

README should describe the new helpers as optional execution aids:

- not a fully automatic pipeline
- not a replacement for round 2 judgment
- intended to reduce workflow reconstruction cost between agents

## Success Criteria

The vNext optimization is successful if:

1. A second agent can determine the correct next step without reconstructing the workflow manually.
2. The workflow still requires judgment at the right points instead of auto-committing to a brittle flow.
3. Report generation becomes a stable, repeatable step.
4. `SKILL.md` remains a thin dispatcher rather than becoming a giant procedural document.

## Suggested Implementation Order

1. Add `workflow-next-step.mjs`
2. Add `report-from-round2.mjs`
3. Update references and README
4. Add doc/tests that lock the new soft-orchestration contract
