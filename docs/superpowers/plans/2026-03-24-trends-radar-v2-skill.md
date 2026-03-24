# trends-radar Skill v2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `trends-radar` into a thinner, more maintainable Skill package with progressive disclosure, stable runtime data, and lightweight usage logging.

**Architecture:** Keep one public Skill, but move detailed workflow knowledge into `references/` and `assets/`, keep deterministic behavior in scripts, and store runtime config/log state outside the installed Skill directory. Preserve the current install, doctor, collect, and round-2 user workflow while tightening packaging and observability.

**Tech Stack:** Markdown, Bash, Node.js, Vitest, JSON, OpenCLI plugin packaging

---

## Planned File Structure

### Existing files to modify

- `README.md`
- `skills/trends-radar/SKILL.md`
- `scripts/install.sh`
- `scripts/doctor.sh`
- `tests/docs.test.ts`
- `tests/install.test.ts`
- `tests/doctor.test.ts`
- `tests/repo-layout.test.ts`

### New files to create

- `skills/trends-radar/references/install.md`
- `skills/trends-radar/references/collect.md`
- `skills/trends-radar/references/round2.md`
- `skills/trends-radar/references/gotchas.md`
- `skills/trends-radar/references/runbook.md`
- `skills/trends-radar/assets/keep.example.json`
- `skills/trends-radar/assets/reject.example.json`
- `skills/trends-radar/assets/config.example.json`
- `scripts/init-config.mjs`
- `scripts/log-usage.mjs`
- `tests/init-config.test.ts`
- `tests/log-usage.test.ts`

### Optional new fixtures

- `tests/fixtures/config-example.json`
- `tests/fixtures/usage-log.jsonl`

### File responsibilities

- `SKILL.md`: trigger policy plus high-level routing only
- `references/*.md`: detailed workflow rules and operational knowledge
- `assets/*.json`: concrete examples for config and round-2 outputs
- `scripts/init-config.mjs`: initialize/update stable config outside the installed Skill directory
- `scripts/log-usage.mjs`: append structured JSONL usage events in a stable runtime location
- `install.sh`: install references/assets/scripts into the installed Skill bundle and ensure stable data dir exists
- `doctor.sh`: validate the new stable data dir and installed bundle layout without becoming an installer
- tests: lock repo layout, packaging, docs contract, stable-data behavior, and usage logging

## Runtime Data Contract

Implementation should standardize on this stable runtime location:

```text
~/.codex/data/trends-radar/
```

Files under that directory:

- `config.json`
- `usage.jsonl`
- `round2-decisions.jsonl` (create lazily; do not force population in V2)
- `runs/` (directory only; may remain empty in V2)

The installed Skill bundle remains under:

```text
~/.codex/skills/trends-radar/
```

and must not be treated as the durable store for runtime state.

### Task 1: Add progressive disclosure resources and thin the Skill entrypoint

**Files:**
- Create: `skills/trends-radar/references/install.md`
- Create: `skills/trends-radar/references/collect.md`
- Create: `skills/trends-radar/references/round2.md`
- Create: `skills/trends-radar/references/gotchas.md`
- Create: `skills/trends-radar/references/runbook.md`
- Create: `skills/trends-radar/assets/keep.example.json`
- Create: `skills/trends-radar/assets/reject.example.json`
- Create: `skills/trends-radar/assets/config.example.json`
- Modify: `skills/trends-radar/SKILL.md`
- Modify: `README.md`
- Test: `tests/docs.test.ts`
- Test: `tests/repo-layout.test.ts`

- [ ] **Step 1: Write the failing layout/documentation tests**

Add assertions that fail until the repo contains the new `references/` and `assets/` files and the main Skill points to them explicitly.

Example assertions:

```ts
expect(existsSync(`${ROOT}/skills/trends-radar/references/gotchas.md`)).toBe(true);
expect(skill).toContain('Read `references/collect.md` for collection details.');
expect(skill).toContain('Use `assets/config.example.json` as the config shape reference.');
```

- [ ] **Step 2: Run targeted tests to verify they fail**

Run:

```bash
npx vitest run tests/docs.test.ts tests/repo-layout.test.ts
```

Expected: FAIL because the new files and reference strings do not exist yet.

- [ ] **Step 3: Create the new reference and asset files with concrete content**

Populate each file with focused content only:

- `install.md`: bootstrap, repair, upgrade
- `collect.md`: compare-tab prep, scope rules, merge semantics, manual CAPTCHA
- `round2.md`: keep/reject contract, live-context cap, output examples
- `gotchas.md`: only real observed failure cases
- `runbook.md`: symptom → remediation routing
- `keep.example.json`, `reject.example.json`, `config.example.json`: short realistic examples

- [ ] **Step 4: Thin `skills/trends-radar/SKILL.md`**

Keep only:

- trigger conditions
- action routing
- reference file pointers
- script entrypoints

Remove long procedural detail that now lives in `references/`.

- [ ] **Step 5: Update `README.md` to match the new structure**

README should remain the bootstrap document, but it should now mention:

- the existence of `references/` and `assets/`
- that the public Skill stays `trends-radar`
- that detailed operational knowledge lives inside the Skill bundle

- [ ] **Step 6: Run targeted tests to verify they pass**

Run:

```bash
npx vitest run tests/docs.test.ts tests/repo-layout.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add README.md skills/trends-radar tests/docs.test.ts tests/repo-layout.test.ts
git commit -m "feat: add trends-radar skill resource layers"
```

### Task 2: Add stable runtime config support

**Files:**
- Create: `scripts/init-config.mjs`
- Modify: `scripts/install.sh`
- Modify: `scripts/doctor.sh`
- Test: `tests/init-config.test.ts`
- Test: `tests/install.test.ts`
- Test: `tests/doctor.test.ts`

- [ ] **Step 1: Write the failing config and packaging tests**

Add tests for these behaviors:

- `init-config.mjs` creates `~/.codex/data/trends-radar/config.json` with expected defaults
- rerunning it preserves existing values unless explicitly refreshed
- `install.sh` ensures the stable data directory exists
- `doctor.sh` checks that the stable data directory is reachable and does not treat it as source content

Example test shape:

```ts
expect(parsed.default_min_rise).toBe(2000);
expect(existsSync(path.join(homeDir, '.codex/data/trends-radar'))).toBe(true);
```

- [ ] **Step 2: Run targeted tests to verify they fail**

Run:

```bash
npx vitest run tests/init-config.test.ts tests/install.test.ts tests/doctor.test.ts
```

Expected: FAIL because `init-config.mjs` and stable-data handling do not exist yet.

- [ ] **Step 3: Implement `scripts/init-config.mjs`**

Behavior:

- create `~/.codex/data/trends-radar/`
- create `config.json` with defaults if missing
- keep existing config on rerun
- print the resolved config path so the calling workflow can surface it if needed

Default payload should at least include:

```json
{
  "default_geo": "US",
  "default_time": "7d",
  "default_min_rise": 2000,
  "default_output_format": "json"
}
```

- [ ] **Step 4: Update `install.sh` to initialize the stable data directory**

Requirements:

- keep bootstrap behavior unchanged for fresh installs
- create the stable data directory if missing
- call the config initializer after the installed bundle is copied
- do not overwrite an existing user config unless the implementation explicitly supports a refresh mode

- [ ] **Step 5: Update `doctor.sh` to validate the new stable data layout**

Doctor should now confirm:

- stable data directory exists
- `config.json` is readable or can be initialized by install
- installed bundle and stable data are separated correctly

Doctor should still fail with actionable messages, not silently repair.

- [ ] **Step 6: Run targeted tests to verify they pass**

Run:

```bash
npx vitest run tests/init-config.test.ts tests/install.test.ts tests/doctor.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/init-config.mjs scripts/install.sh scripts/doctor.sh tests/init-config.test.ts tests/install.test.ts tests/doctor.test.ts
git commit -m "feat: add stable trends-radar config initialization"
```

### Task 3: Add lightweight usage logging

**Files:**
- Create: `scripts/log-usage.mjs`
- Modify: `scripts/install.sh`
- Modify: `scripts/doctor.sh`
- Modify: `README.md`
- Test: `tests/log-usage.test.ts`
- Test: `tests/install.test.ts`
- Test: `tests/doctor.test.ts`
- Test: `tests/docs.test.ts`

- [ ] **Step 1: Write the failing usage-log tests**

Lock these behaviors:

- `log-usage.mjs` appends one valid JSON object per line to `usage.jsonl`
- log records contain `timestamp`, `action`, `status`
- install and doctor paths can call the logger without corrupting output

Example assertion:

```ts
expect(record.action).toBe('doctor');
expect(record.status).toBe('ok');
expect(typeof record.timestamp).toBe('string');
```

- [ ] **Step 2: Run targeted tests to verify they fail**

Run:

```bash
npx vitest run tests/log-usage.test.ts tests/install.test.ts tests/doctor.test.ts tests/docs.test.ts
```

Expected: FAIL because the logger does not exist and docs do not mention usage logging yet.

- [ ] **Step 3: Implement `scripts/log-usage.mjs`**

Behavior:

- append newline-delimited JSON to `~/.codex/data/trends-radar/usage.jsonl`
- create the file if missing
- accept action and status inputs from callers
- allow optional `reason` or `counts` fields

- [ ] **Step 4: Wire install and doctor to emit minimal usage records**

Requirements:

- log only high-level action outcomes
- do not log secrets or large payloads
- keep stdout/stderr readable for humans

At minimum:

- successful install/repair writes one record
- doctor writes one success or failure record

- [ ] **Step 5: Update README and docs contract**

README should explain:

- where stable data lives
- that `usage.jsonl` is append-only
- that runtime memory survives upgrades

`tests/docs.test.ts` should assert those statements.

- [ ] **Step 6: Run targeted tests to verify they pass**

Run:

```bash
npx vitest run tests/log-usage.test.ts tests/install.test.ts tests/doctor.test.ts tests/docs.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/log-usage.mjs scripts/install.sh scripts/doctor.sh README.md tests/log-usage.test.ts tests/install.test.ts tests/doctor.test.ts tests/docs.test.ts
git commit -m "feat: add trends-radar usage logging"
```

### Task 4: Tighten docs, examples, and eval coverage around V2

**Files:**
- Modify: `README.md`
- Modify: `skills/trends-radar/SKILL.md`
- Modify: `evals/evals.json`
- Modify: `tests/docs.test.ts`
- Modify: `tests/repo-layout.test.ts`
- Optional: `tests/fixtures/config-example.json`

- [ ] **Step 1: Write the failing docs/evals tests**

Add assertions for:

- stable data directory path
- config example availability
- usage log availability
- references/gotchas existence
- explicit statement that V2 still exposes one public Skill
- eval prompts that cover config initialization or stable-data troubleshooting

- [ ] **Step 2: Run targeted tests to verify they fail**

Run:

```bash
npx vitest run tests/docs.test.ts tests/repo-layout.test.ts
```

Expected: FAIL until docs and evals reflect the V2 design.

- [ ] **Step 3: Update docs and evals**

Make the user-facing docs truthful and current:

- README reflects stable-data, config, and usage logging
- top-level Skill reflects thinner routing behavior
- evals cover the new V2 concerns

- [ ] **Step 4: Run focused tests to verify they pass**

Run:

```bash
npx vitest run tests/docs.test.ts tests/repo-layout.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run the full verification suite**

Run:

```bash
npx vitest run tests/init-config.test.ts tests/log-usage.test.ts
npm test
```

Expected:

- new targeted suites PASS
- full repo suite PASS with zero failing test files

- [ ] **Step 6: Commit**

```bash
git add README.md skills/trends-radar/SKILL.md evals/evals.json tests/docs.test.ts tests/repo-layout.test.ts tests/init-config.test.ts tests/log-usage.test.ts
git commit -m "docs: finalize trends-radar v2 skill packaging"
```

## Final Verification Checklist

Before claiming the plan implementation is complete, verify:

- the installed Skill still supports `install`, `doctor`, `collect`, and `round2`
- `references/` and `assets/` are installed into the Skill bundle
- stable config survives reinstall
- `usage.jsonl` persists across reinstall
- docs and evals match the actual V2 behavior
- the full test suite passes

## Expected Commit Sequence

1. `feat: add trends-radar skill resource layers`
2. `feat: add stable trends-radar config initialization`
3. `feat: add trends-radar usage logging`
4. `docs: finalize trends-radar v2 skill packaging`
