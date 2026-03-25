# Round 2 Reference

Use this reference after `round2-prepare.mjs` has normalized the first-stage JSON input into candidate rows.

## Hard rules

- `round2-prepare.mjs` only normalizes candidates; the agent still owns the keep/reject judgment.
- Round 1 must exist before round 2 begins.
- `report-from-round2.mjs` may format a report after keep/reject exist, but it must not invent or overwrite the judgment itself.
- If the helper returns no candidates, write `[]` to both output files and stop.

## Soft rules

- Choose how many keywords to keep based on the actual opportunity set, not an arbitrary quota.
- Borderline brand or repository-like terms can stay in review when the demand loop is still siteable.
- Gather only as much live context as needed to make a defensible keep/reject call.
- Keep the report concise and conclusion-first unless the user asks for deeper analysis.

## keep/reject contract

- Keep rows represent keywords that still look siteable after judgment.
- Reject rows represent keywords that should be excluded with a stable reason.

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

## Open-source project keyword exception

- Do not auto-reject a keyword only because it looks branded, repository-like, or product-like.
- If the keyword maps to an open-source project, route it through a second judgment pass before using `navigational` as the reject reason.
- In that second pass, ask whether the keyword can still support an independent siteable demand loop through at least one of:
  - tutorials
  - templates
  - case studies
  - plugins
  - community aggregation
  - alternatives / comparisons
- If at least one such loop exists, keep the keyword in review instead of rejecting it immediately.
- Commercial brand keywords still default to `navigational` unless there is separate evidence of an independent demand loop beyond finding the official property.

## Example assets

- Use `assets/keep.example.json` for a realistic keep row.
- Use `assets/reject.example.json` for a realistic reject row.
- Use `report-from-round2.mjs` when you already have keep/reject files and want a conclusion-first report scaffold without redoing the judgment.
