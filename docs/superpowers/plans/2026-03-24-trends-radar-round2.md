# trends-radar Round 2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a simple round-2 `trends-radar` workflow that reads first-stage collector JSON, prepares deduplicated candidate keywords, and lets the Skill write `keep` and `reject` outputs with lightweight live-context filtering.

**Architecture:** Keep the user-facing workflow as one Codex Skill action, but move deterministic work into a small local helper script. The helper validates the first-stage JSON, merges repeated keywords across seeds, derives output paths, and emits normalized candidates; the Skill then performs the human-like judgment step and writes the final keep/reject files.

**Tech Stack:** Codex Skill instructions, Node.js ESM script, Vitest, JSON fixtures

---

### Task 1: Add Round 2 Prep Helper

**Files:**
- Create: `scripts/round2-prepare.mjs`
- Create: `tests/round2-prepare.test.ts`
- Create: `tests/fixtures/round2-input.json`
- Modify: `tests/repo-layout.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Add `tests/round2-prepare.test.ts` covering:
- valid first-stage input with one result item
- duplicate keyword merge across different seeds into `seeds[]`
- preserve highest numeric `rise_pct`
- breakout-only rows become `rise_pct: null`
- malformed top-level JSON without `results` fails
- malformed item without `seed`, `related_query`, or `is_breakout` fails
- derived output paths end in `.keep.json` and `.reject.json`

Create `tests/fixtures/round2-input.json` with representative first-stage `results` entries.

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
npx vitest run tests/round2-prepare.test.ts
```

Expected:
- FAIL because `scripts/round2-prepare.mjs` does not exist yet

- [ ] **Step 3: Implement the helper**

Create `scripts/round2-prepare.mjs` as a Node ESM script that:
- accepts one positional argument: path to first-stage JSON
- reads and parses the input file
- validates top-level `{ results: [...] }`
- validates required per-item fields: `seed`, `related_query`, `is_breakout`
- merges duplicate `related_query` values across seeds
- emits normalized JSON to stdout with this shape:

```json
{
  "inputPath": "/tmp/round1.json",
  "keepPath": "/tmp/round1.keep.json",
  "rejectPath": "/tmp/round1.reject.json",
  "candidates": [
    {
      "keyword": "ghibli style image",
      "seeds": ["ghibli", "ai image generator"],
      "rise_pct": 4200,
      "is_breakout": false
    }
  ]
}
```

Implementation notes:
- `keyword` comes from first-stage `related_query`
- `rise_pct` is the max numeric value seen across merged rows, else `null` if the keyword is breakout-only
- `is_breakout` is `true` if any merged row is breakout
- fail fast with actionable stderr text on missing file, invalid JSON, or invalid structure

- [ ] **Step 4: Run the helper tests to verify they pass**

Run:

```bash
npx vitest run tests/round2-prepare.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Run related regression coverage**

Run:

```bash
npx vitest run tests/repo-layout.test.ts
```

Expected:
- PASS with the new helper included in repo-layout expectations

- [ ] **Step 6: Commit**

```bash
git add scripts/round2-prepare.mjs tests/round2-prepare.test.ts tests/fixtures/round2-input.json tests/repo-layout.test.ts
git commit -m "feat: add round 2 candidate preparation helper"
```

### Task 2: Extend the Skill for Round 2

**Files:**
- Modify: `skills/trends-radar/SKILL.md`
- Modify: `README.md`
- Modify: `evals/evals.json`
- Modify: `tests/docs.test.ts`

- [ ] **Step 1: Write the failing documentation tests**

Update `tests/docs.test.ts` to assert round-2 coverage includes:
- explicit trigger wording for round 2, e.g. `使用 trends-radar 做二轮筛选`
- running `node scripts/round2-prepare.mjs /path/to/round1.json`
- writing `round1.keep.json` and `round1.reject.json`
- allowed keep `site_type` values: `tool`, `game`, `content`, `mixed`
- allowed reject reasons: `short_term_event`, `noise`, `not_siteable`, `too_broad`, `navigational`

- [ ] **Step 2: Run the docs test to verify it fails**

Run:

```bash
npx vitest run tests/docs.test.ts
```

Expected:
- FAIL because round-2 instructions are not documented yet

- [ ] **Step 3: Update the Skill**

Modify `skills/trends-radar/SKILL.md` so round 2 is an explicit action.

Required round-2 behavior in the Skill:
- ask only for the first-stage JSON path if it is missing
- run `node scripts/round2-prepare.mjs <input>`
- review each normalized candidate
- use lightweight live context with a hard cap of three evidence items per keyword
- if live context is unavailable, continue with first-stage context only and mention that in reasoning
- write bare-array JSON outputs to the helper-provided `keepPath` and `rejectPath`
- keep output fields:
  - `keyword`
  - `seeds`
  - `rise_pct`
  - `site_type`
  - `why`
  - `evidence`
- reject output fields:
  - `keyword`
  - `seeds`
  - `reject_reason`
  - `why`

- [ ] **Step 4: Update the README**

Add a short `Round 2` section to `README.md` showing:
- the first-stage collector command
- the explicit round-2 Skill invocation
- the output filenames
- the fact that round 2 is a Codex skill step, not an OpenCLI command

- [ ] **Step 5: Update eval coverage**

Update `evals/evals.json` with at least:
- one explicit round-2 prompt using a first-stage JSON path
- one non-trigger prompt that mentions filtering keywords but does not explicitly name `trends-radar`

- [ ] **Step 6: Run docs and eval-facing tests**

Run:

```bash
npx vitest run tests/docs.test.ts
```

Expected:
- PASS

- [ ] **Step 7: Commit**

```bash
git add skills/trends-radar/SKILL.md README.md evals/evals.json tests/docs.test.ts
git commit -m "feat: add round 2 skill workflow"
```

### Task 3: End-to-End Verification

**Files:**
- Modify: `tests/repo-layout.test.ts`
- Modify: `README.md` (only if verification exposes mismatch)

- [ ] **Step 1: Verify helper output on fixture input**

Run:

```bash
node scripts/round2-prepare.mjs tests/fixtures/round2-input.json
```

Expected:
- JSON printed to stdout with `inputPath`, `keepPath`, `rejectPath`, and `candidates`

- [ ] **Step 2: Run the full root test suite**

Run:

```bash
npm test
```

Expected:
- PASS with all root tests green, including round-2 helper and docs tests

- [ ] **Step 3: Sanity-check git state**

Run:

```bash
git status --short --branch
```

Expected:
- branch ahead of `origin/main` only by the new round-2 commits
- no unexpected untracked files except approved fixture additions

- [ ] **Step 4: Commit any final doc/test sync**

If Task 3 exposed a mismatch and you changed tracked files:

```bash
git add README.md tests/repo-layout.test.ts
git commit -m "test: align round 2 docs and verification"
```

- [ ] **Step 5: Push after verification**

```bash
git push origin main
```
