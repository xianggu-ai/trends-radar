# Trends Radar Soft Orchestration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a soft orchestration layer to `trends-radar` that reduces workflow reconstruction across agents without turning the workflow into a rigid one-click pipeline.

**Architecture:** Keep `SKILL.md` as a thin dispatcher, add one helper that recommends the next workflow step plus normalized artifact paths, and add one helper that generates a conclusion-first report scaffold from round 1 / round 2 outputs. Update references and docs so the new helpers are clearly optional execution aids rather than hard rails.

**Tech Stack:** Node.js ESM scripts, existing `trends-radar` skill references/assets, Vitest documentation contract tests.

---

### Task 1: Add Workflow Next-Step Helper

**Files:**
- Create: `scripts/workflow-next-step.mjs`
- Test: `tests/workflow-next-step.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/workflow-next-step.test.ts` covering:
- empty inputs recommend `doctor`
- round 1 present but round 2 missing recommends `round2`
- round 2 present but report missing recommends `report`
- output includes normalized paths and a short rationale

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/workflow-next-step.test.ts`
Expected: FAIL because `scripts/workflow-next-step.mjs` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/workflow-next-step.mjs` that:
- accepts optional CLI args for `--round1`, `--keep`, `--reject`, `--report`
- derives default sibling paths when only round 1 is provided
- returns JSON with:
  - `next_action`
  - `round1_path`
  - `keep_path`
  - `reject_path`
  - `report_path`
  - `reason`
- uses only soft recommendations, not hard execution

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/workflow-next-step.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/workflow-next-step.mjs tests/workflow-next-step.test.ts
git commit -m "feat: add workflow next-step helper"
```

### Task 2: Add Report Helper

**Files:**
- Create: `scripts/report-from-round2.mjs`
- Test: `tests/report-from-round2.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/report-from-round2.test.ts` covering:
- conclusion-first markdown is generated from valid `keep/reject`
- report contains summary counts plus top kept keywords
- report preserves agent-authored `why` and `evidence`
- report helper does not perform keep/reject judgment itself

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/report-from-round2.test.ts`
Expected: FAIL because `scripts/report-from-round2.mjs` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/report-from-round2.mjs` that:
- accepts `--round1`, `--keep`, `--reject`, optional `--out`
- reads JSON inputs and writes markdown output
- emits:
  - conclusion-first summary
  - kept keyword section
  - reject breakdown
  - short method note
- never overrides or invents `why` / `evidence` text

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/report-from-round2.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/report-from-round2.mjs tests/report-from-round2.test.ts
git commit -m "feat: add round2 report helper"
```

### Task 3: Update Skill and References

**Files:**
- Modify: `skills/trends-radar/SKILL.md`
- Modify: `skills/trends-radar/references/runbook.md`
- Modify: `skills/trends-radar/references/round2.md`
- Modify: `skills/trends-radar/references/gotchas.md`
- Modify: `README.md`
- Test: `tests/docs.test.ts`

- [ ] **Step 1: Write or extend failing doc assertions**

Extend `tests/docs.test.ts` so it fails until docs mention:
- `workflow-next-step.mjs`
- `report-from-round2.mjs`
- helpers are optional execution aids, not a full run-all pipeline
- hard rules vs soft rules separation

- [ ] **Step 2: Run doc test to verify failure**

Run: `npx vitest run tests/docs.test.ts`
Expected: FAIL until the new helpers and workflow language appear in docs.

- [ ] **Step 3: Update docs minimally**

Update:
- `SKILL.md` to mention soft orchestration helpers without bloating the entrypoint
- `runbook.md` to describe `collect -> round2 -> report`
- `round2.md` to clarify helper prepares artifacts but agent owns judgment
- `gotchas.md` to warn against over-automation and false confidence
- `README.md` to present helpers as optional aids

- [ ] **Step 4: Run doc test to verify it passes**

Run: `npx vitest run tests/docs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md skills/trends-radar/SKILL.md skills/trends-radar/references/runbook.md skills/trends-radar/references/round2.md skills/trends-radar/references/gotchas.md tests/docs.test.ts
git commit -m "docs: add soft orchestration guidance"
```

### Task 4: Verify Installed Bundle and Repo Workflow Stay Aligned

**Files:**
- Modify: `scripts/install.sh`
- Test: `tests/install.test.ts`

- [ ] **Step 1: Extend install test**

Update `tests/install.test.ts` so it verifies the new helper scripts are copied into the installed skill bundle.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/install.test.ts`
Expected: FAIL until install logic copies the new helper scripts.

- [ ] **Step 3: Update install script**

Modify `scripts/install.sh` to copy:
- `scripts/workflow-next-step.mjs`
- `scripts/report-from-round2.mjs`

into the installed skill bundle under `${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/`.

- [ ] **Step 4: Run install test to verify it passes**

Run: `npx vitest run tests/install.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/install.sh tests/install.test.ts
git commit -m "test: sync installed bundle with soft orchestration helpers"
```

### Task 5: Full Verification

**Files:**
- Verify only

- [ ] **Step 1: Run targeted tests**

Run:
```bash
npx vitest run tests/workflow-next-step.test.ts tests/report-from-round2.test.ts tests/docs.test.ts tests/install.test.ts
```
Expected: all targeted tests pass.

- [ ] **Step 2: Run full suite**

Run:
```bash
npm test
```
Expected: full repository test suite passes.

- [ ] **Step 3: Spot-check helper outputs**

Run:
```bash
node scripts/workflow-next-step.mjs --round1 tmp-round1-live-2.json
node scripts/report-from-round2.mjs --round1 tmp-round1-live-2.json --keep tmp-round1-live-2.keep.json --reject tmp-round1-live-2.reject.json
```
Expected:
- first command prints a valid JSON recommendation
- second command writes a markdown report without changing keep/reject judgment content

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add soft orchestration layer"
```
