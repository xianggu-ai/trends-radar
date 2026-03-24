# trends-radar Round 2 Filter Design

## Goal

Add a second-stage `trends-radar` Skill workflow that takes the first-stage Google Trends collector output and filters it down to keywords worth turning into websites.

This stage exists to remove:

- short-lived event terms
- irrelevant or noisy terms
- terms that do not map cleanly to a tool site, game site, content site, or a mixed opportunity

This stage should stay simple. It should not introduce another complex scoring system or a second crawler. It should behave like a lightweight Codex workflow that reads a first-stage JSON file and writes two concise result files.

## Scope

In scope:

- explicit `trends-radar` Skill support for "round 2" filtering
- reading a first-stage JSON results file
- filtering each candidate into `keep` or `reject`
- assigning a kept term to `tool`, `game`, `content`, or `mixed`
- writing structured output files next to the input file

Out of scope:

- re-running Google Trends collection
- automatic site generation
- a public API or separate service
- a large multi-agent committee system
- exposing internal score breakdowns in the final output

## User Workflow

The user runs round 1 first and gets a JSON file from:

```bash
opencli google collect-open-trends-tabs --min-rise 2000 -f json
```

Then the user explicitly invokes round 2 via Codex, for example:

```text
使用 trends-radar 做二轮筛选，输入文件是 /path/to/round1.json
```

If the user does not provide a file path, the Skill should ask only for the first-stage JSON file path before continuing.

## Input Contract

Round 2 reads the first-stage collector JSON and consumes only the data needed for filtering:

- `results`
- optional run scope context when useful for prompts or summaries

Each candidate should at minimum carry forward:

- `seed`
- `related_query` as the keyword under review
- `rise_pct` when present
- `is_breakout` when present

Round 2 should deduplicate identical candidate keywords within the same input file before review.
If the same `keyword` appears under multiple seeds, round 2 should merge them into one review item and preserve all originating seeds as a `seeds` array in the final output.

## Output Contract

Round 2 writes two files in the same directory as the input file:

- `round1.keep.json`
- `round1.reject.json`

The exact stem should be derived from the input filename. For example, `/tmp/round1.json` produces:

- `/tmp/round1.keep.json`
- `/tmp/round1.reject.json`

### Keep Output

Each kept item should contain only:

- `keyword`
- `seeds`
- `rise_pct`
- `site_type`
- `why`
- `evidence`

`evidence` must be an array of 2 to 4 short strings, not a freeform paragraph and not a structured object.

Allowed `site_type` values:

- `tool`
- `game`
- `content`
- `mixed`

### Reject Output

Each rejected item should contain only:

- `keyword`
- `seeds`
- `reject_reason`
- `why`

Allowed `reject_reason` values:

- `short_term_event`
- `noise`
- `not_siteable`
- `too_broad`
- `navigational`

Definitions:

- `short_term_event`: interest is primarily driven by a recent event and is likely to decay quickly
- `noise`: the term is irrelevant, malformed, or semantically weak enough that it is not worth site-building review
- `not_siteable`: the intent is real, but it does not map well to a standalone site
- `too_broad`: the term is so broad that a useful first site concept cannot be scoped cleanly
- `navigational`: the term mainly points users to an existing brand, app, or destination rather than a new site opportunity

Round 2 should not expose raw internal scoring fields in the output.

## Decision Logic

Round 2 should behave as a simple 3-step workflow.

### Step 1: Normalize Candidates

- load the first-stage JSON file
- extract `results`
- map each result into a candidate keyword review record
- deduplicate exact keyword repeats within the same input
- merge repeated keywords across different seeds into one item with `seeds[]`
- preserve the highest available `rise_pct` for the merged keyword row

### Step 2: Codex Review

For each candidate keyword, Codex should answer only these questions:

1. Is this primarily a short-term event term?
2. Is this primarily noise, navigational, or too broad to turn into a standalone site?
3. If kept, is it best suited to `tool`, `game`, `content`, or `mixed`?

The review should prefer short, actionable reasoning over essay-style analysis.

### Step 3: Write Results

- kept items go to `*.keep.json`
- rejected items go to `*.reject.json`
- no extra report is required in V1

## Evidence Requirements

Round 2 should not rely on keyword text alone. The workflow should use lightweight live contextual evidence so the model is not guessing blindly.

Minimum evidence for each reviewed keyword:

- originating `seeds`
- `rise_pct` or breakout status from round 1
- nearby first-stage context when available
- lightweight live context gathered during round 2

V1 should include lightweight live context. That live context must stay narrow and bounded. The plan should assume a small amount of external evidence per candidate, such as:

- a few web result titles/snippets
- obvious signs that the term is tied to a very recent event
- obvious signs that the term maps to a tool, game, or content intent

V1 should not turn live context collection into a large new subsystem or a second crawler.

## Example Shapes

Example normalized candidate before review:

```json
{
  "keyword": "ghibli style image",
  "seeds": ["ghibli", "ai image generator"],
  "rise_pct": 4200,
  "is_breakout": false
}
```

Example keep item:

```json
{
  "keyword": "ghibli style image",
  "seeds": ["ghibli", "ai image generator"],
  "rise_pct": 4200,
  "site_type": "tool",
  "why": "The query points to a repeatable image-generation task that can be satisfied by a dedicated tool page or small tool site.",
  "evidence": [
    "Appears under multiple related seeds from round 1.",
    "Search intent is task-oriented rather than purely news-oriented.",
    "The phrasing suggests a reusable conversion workflow."
  ]
}
```

Example reject item:

```json
{
  "keyword": "openai keynote monday",
  "seeds": ["openai event", "ai news"],
  "reject_reason": "short_term_event",
  "why": "Interest is tied to a specific event window and is unlikely to support a durable standalone site."
}
```

## Error Handling

Round 2 should fail clearly when:

- the input file does not exist
- the input file is not valid JSON
- the input file does not contain the expected first-stage `results` structure

Round 2 should not silently produce empty keep/reject files from malformed input.

If the input file is valid but `results` is empty:

- write empty keep/reject files
- clearly state that no candidates were available for round 2

## Testing

Implementation should verify:

- valid first-stage input produces keep/reject files in the same directory
- malformed or incompatible input fails with actionable errors
- duplicate keywords are not reviewed twice
- final outputs contain only the simplified fields
- reject reasons stay within the allowed set
- kept site types stay within the allowed set

## Notes for Planning

The important constraint is simplicity:

- one Skill
- one round-2 workflow
- two output files
- no exposed score soup
- no multi-agent committee in V1

If later quality is not good enough, internal decision steps can become more structured without changing the user-facing output contract.
