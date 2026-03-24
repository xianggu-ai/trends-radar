# trends-radar Round 2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a simple round-2 `trends-radar` workflow that reads first-stage collector JSON, prepares deduplicated candidate keywords, and lets the Skill write `keep` and `reject` outputs with lightweight live-context filtering.

**Architecture:** Keep the user-facing workflow as one Codex Skill action, but move deterministic work into a small local helper script that is installed with the Skill bundle. The helper validates the first-stage JSON, handles the empty-results case, merges repeated keywords across seeds, derives output paths, and emits normalized candidates plus condensed first-stage context; the Skill then performs the judgment step and writes the final keep/reject files.

**Tech Stack:** Codex Skill instructions, Node.js ESM script, Vitest, JSON fixtures

---

### Task 1: Add Round 2 Prep Helper

**Files:**
- Create: `scripts/round2-prepare.mjs`
- Create: `tests/round2-prepare.test.ts`
- Create: `tests/fixtures/round2-input.json`
- Create: `tests/fixtures/round2-empty.json`
- Modify: `tests/repo-layout.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Add `tests/round2-prepare.test.ts` covering:
- valid first-stage input with one result item
- duplicate `related_query` rows under the same seed are deduplicated
- duplicate keyword merge across different seeds into `seeds[]`
- preserve highest numeric `rise_pct`
- breakout-only rows become `rise_pct: null`
- valid-but-empty `results` returns zero candidates instead of failing
- malformed top-level JSON without `results` fails
- malformed item without `seed`, `related_query`, or `is_breakout` fails
- derived output paths end in `.keep.json` and `.reject.json`
- normalized candidates include condensed first-stage context for the Skill

Create `tests/fixtures/round2-input.json` with representative first-stage `results` entries.
Create `tests/fixtures/round2-empty.json` with a valid top-level object and an empty `results` array.

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
- allows valid-but-empty `results` and returns zero candidates
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
      "is_breakout": false,
      "source_context": [
        {
          "seed": "ghibli",
          "rise_pct": 4200,
          "is_breakout": false
        }
      ]
    }
  ]
}
```

Implementation notes:
- `keyword` comes from first-stage `related_query`
- `rise_pct` is the max numeric value seen across merged rows, else `null` if the keyword is breakout-only
- `is_breakout` is `true` if any merged row is breakout
- `source_context` is a condensed array of source rows the Skill can use as first-stage context
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
npx vitest run tests/round2-prepare.test.ts tests/repo-layout.test.ts
```

Expected:
- PASS with the new helper included in repo-layout expectations

- [ ] **Step 6: Commit**

```bash
git add scripts/round2-prepare.mjs tests/round2-prepare.test.ts tests/fixtures/round2-input.json tests/fixtures/round2-empty.json tests/repo-layout.test.ts
git commit -m "feat: add round 2 candidate preparation helper"
```

### Task 2: Package the Helper into the Installed Skill Bundle

**Files:**
- Modify: `scripts/install.sh`
- Modify: `tests/install.test.ts`

- [ ] **Step 1: Write the failing install-path tests**

Update `tests/install.test.ts` so install coverage asserts:
- `scripts/round2-prepare.mjs` is copied into `~/.codex/skills/trends-radar/scripts/round2-prepare.mjs`
- installed repair preserves or restores the helper

- [ ] **Step 2: Run the install test to verify it fails**

Run:

```bash
npx vitest run tests/install.test.ts
```

Expected:
- FAIL because the installer does not copy the round-2 helper yet

- [ ] **Step 3: Update installation packaging**

Modify `scripts/install.sh` so the installed Skill bundle includes:
- `scripts/install.sh`
- `scripts/doctor.sh`
- `scripts/round2-prepare.mjs`

Implementation notes:
- the repo checkout and installed-bundle repair flow should both work
- the installed Skill must be able to invoke the helper by absolute installed path

- [ ] **Step 4: Run install tests to verify they pass**

Run:

```bash
npx vitest run tests/install.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/install.sh tests/install.test.ts
git commit -m "feat: install round 2 helper with skill bundle"
```

### Task 3: Extend the Skill for Round 2

**Files:**
- Modify: `skills/trends-radar/SKILL.md`
- Modify: `README.md`
- Modify: `evals/evals.json`
- Modify: `tests/docs.test.ts`

- [ ] **Step 1: Write the failing documentation tests**

Update `tests/docs.test.ts` to assert round-2 coverage includes:
- explicit trigger wording for round 2, e.g. `使用 trends-radar 做二轮筛选`
- running `node ~/.codex/skills/trends-radar/scripts/round2-prepare.mjs /path/to/round1.json` or the installed equivalent path expression
- writing `round1.keep.json` and `round1.reject.json`
- allowed keep `site_type` values: `tool`, `game`, `content`, `mixed`
- allowed reject reasons: `short_term_event`, `noise`, `not_siteable`, `too_broad`, `navigational`
- handling the valid-but-empty `results` case by writing empty arrays and telling the user no candidates were available

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
- run the installed helper path, not a repo-relative path
- review each normalized candidate
- use lightweight live context with a hard cap of three evidence items per keyword
- if live context is unavailable, continue with first-stage context only and include one short fallback note inside the kept row's `evidence` array
- use `source_context` from the helper as the first-stage context input for each keyword
- if `candidates` is empty, write `[]` to both output files and tell the user no candidates were available for round 2
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
- the installed helper path that the Skill uses
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

### Task 4: End-to-End Verification and Handoff

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

- [ ] **Step 2: Refresh the installed Skill bundle before manual verification**

Run:

```bash
./scripts/install.sh
```

Expected:
- installed Skill bundle under `~/.codex/skills/trends-radar/` contains the new Skill text and `scripts/round2-prepare.mjs`

- [ ] **Step 3: Verify empty-results handling**

Run:

```bash
node scripts/round2-prepare.mjs tests/fixtures/round2-empty.json
```

Expected:
- JSON printed to stdout with empty `candidates`
- no error exit

- [ ] **Step 4: Run one fixture-driven round-2 Skill pass**

Prepare a temp copy outside the repo so generated files do not dirty git:

```bash
mkdir -p /tmp/trends-radar-round2
cp tests/fixtures/round2-input.json /tmp/trends-radar-round2/round2-input.json
```

In a fresh Codex turn, invoke:

```text
使用 trends-radar 做二轮筛选，输入文件是 /tmp/trends-radar-round2/round2-input.json
```

Expected:
- the Skill runs the installed helper path
- `/tmp/trends-radar-round2/round2-input.keep.json` is created
- `/tmp/trends-radar-round2/round2-input.reject.json` is created

- [ ] **Step 5: Inspect generated round-2 outputs**

Run:

```bash
node -e "const fs=require('fs'); for (const file of ['/tmp/trends-radar-round2/round2-input.keep.json','/tmp/trends-radar-round2/round2-input.reject.json']) { const data=JSON.parse(fs.readFileSync(file,'utf8')); if (!Array.isArray(data)) throw new Error(file + ' is not an array'); console.log(file, data.length); }"
```

Expected:
- both files parse as bare JSON arrays

Then spot-check field shape:

```bash
node -e "const fs=require('fs'); const keep=JSON.parse(fs.readFileSync('/tmp/trends-radar-round2/round2-input.keep.json','utf8')); const reject=JSON.parse(fs.readFileSync('/tmp/trends-radar-round2/round2-input.reject.json','utf8')); for (const row of keep) { const keys=Object.keys(row).sort().join(','); if (keys !== ['evidence','keyword','rise_pct','seeds','site_type','why'].sort().join(',')) throw new Error('bad keep keys: ' + keys); if (!['tool','game','content','mixed'].includes(row.site_type)) throw new Error('bad site_type'); if (!Array.isArray(row.evidence) || row.evidence.length < 2 || row.evidence.length > 4) throw new Error('bad evidence'); } for (const row of reject) { const keys=Object.keys(row).sort().join(','); if (keys !== ['keyword','reject_reason','seeds','why'].sort().join(',')) throw new Error('bad reject keys: ' + keys); if (!['short_term_event','noise','not_siteable','too_broad','navigational'].includes(row.reject_reason)) throw new Error('bad reject_reason'); } console.log('round2 output contract OK');"
```

Expected:
- output contract check passes

- [ ] **Step 6: Verify the no-live-context fallback shape**

In a fresh Codex turn, invoke a second run that explicitly skips live lookups:

```text
使用 trends-radar 做二轮筛选，输入文件是 /tmp/trends-radar-round2/round2-input.json。这次不要获取 live context，只用一轮上下文继续，并按 fallback 规则输出。
```

Then inspect the kept output:

```bash
node -e "const fs=require('fs'); const keep=JSON.parse(fs.readFileSync('/tmp/trends-radar-round2/round2-input.keep.json','utf8')); if (!keep.every(row => Array.isArray(row.evidence) && row.evidence.some(item => /live context unavailable/i.test(item)))) throw new Error('missing live-context fallback note'); console.log('fallback evidence note OK');"
```

Expected:
- kept rows still use the normal `evidence` array shape
- at least one evidence item explicitly notes missing live context

- [ ] **Step 7: Run one empty-results Skill pass**

Prepare a temp copy:

```bash
cp tests/fixtures/round2-empty.json /tmp/trends-radar-round2/round2-empty.json
```

In a fresh Codex turn, invoke:

```text
使用 trends-radar 做二轮筛选，输入文件是 /tmp/trends-radar-round2/round2-empty.json
```

Expected:
- `/tmp/trends-radar-round2/round2-empty.keep.json` contains `[]`
- `/tmp/trends-radar-round2/round2-empty.reject.json` contains `[]`
- the assistant clearly says no candidates were available for round 2

- [ ] **Step 8: Run the full root test suite**

Run:

```bash
npm test
```

Expected:
- PASS with all root tests green, including round-2 helper and docs tests

- [ ] **Step 9: Sanity-check git state**

Run:

```bash
git status --short --branch
```

Expected:
- branch ahead of `origin/main` only by the new round-2 commits
- no unexpected untracked files, because manual verification artifacts were written under `/tmp`

- [ ] **Step 10: Commit any final doc/test sync**

If Task 4 exposed a mismatch and you changed tracked files:

```bash
git add README.md tests/repo-layout.test.ts
git commit -m "test: align round 2 docs and verification"
```

- [ ] **Step 11: Handoff to finishing workflow**

Use `superpowers:finishing-a-development-branch` after verification instead of assuming a direct push to `main`.
