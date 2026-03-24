# Round 2 Reference

Use this reference after `round2-prepare.mjs` has normalized the first-stage JSON input into candidate rows.

## keep/reject contract

- Keep rows represent keywords that still look siteable after judgment.
- Reject rows represent keywords that should be excluded with a stable reason.
- If the helper returns no candidates, write `[]` to both output files and stop.

## Output schema guidance

Keep rows must include:

- `keyword`
- `seeds`
- `rise_pct`
- `site_type`
- `why`
- `evidence`

Reject rows must include:

- `keyword`
- `seeds`
- `reject_reason`
- `why`

Allowed `site_type` values:

- `tool`
- `game`
- `content`
- `mixed`

Allowed `reject_reason` values:

- `short_term_event`
- `noise`
- `not_siteable`
- `too_broad`
- `navigational`

## Live-context budget

- Use lightweight live context with a hard cap of three evidence items per kept keyword.
- If live context is unavailable, continue with first-stage context only and include one short fallback note in `evidence`.

## Example assets

- Use `assets/keep.example.json` for a realistic keep row.
- Use `assets/reject.example.json` for a realistic reject row.
