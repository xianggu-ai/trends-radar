# Runbook

Use this file for the verified macOS + Chrome + OpenCLI collection path. It records the workflow that has already been proven in a live browser session, plus the current limits that still require human judgment.

## Verified Live Workflow

1. Run `doctor` first and do not collect until it passes.
2. In desktop Chrome, enable `View -> Developer -> Allow JavaScript from Apple Events`.
3. Manually open the Google Trends compare pages to collect.
4. Keep every compare page on the same `geo`, `time`, `category`, and `search property`.
5. Resolve any CAPTCHA or unusual-traffic page manually before starting collection.
6. Run `opencli google collect-open-trends-tabs --min-rise 2000 -f json`.
7. Let the collector drive the visible pages. The browser will visibly activate tabs and click each query paginator's `Next` button when more than five `Rising` rows exist.
8. Use the JSON output as the first-stage result set for round 2.

## Workflow Routing

- `workflow-next-step.mjs` is the optional routing helper when an agent needs artifact-aware next-step guidance without a rigid pipeline.
- A typical route is `collect -> round2 -> report`, but the helper should only recommend the next likely action.
- `report-from-round2.mjs` is the optional report helper once keep/reject files already exist.
- The agent still decides whether the current artifacts are trustworthy enough to continue.

## What The Collector Now Does

- Reads the real Google Trends compare tabs that are already open in Chrome.
- Parses each page's seed keywords from the compare URL.
- Collects `Related queries -> Rising` rows for every seed on the page.
- Automatically paginates through later `Showing 1–5 of N queries` pages when the `Next` button is available.
- Merges results by `seed + related_query + scope`.
- Keeps only `Breakout` rows or rows whose rise exceeds the configured `--min-rise`.

## Known Limits

- `geo: ""` in output means the page was collected in `Worldwide` scope because Google Trends omits `geo` from the compare URL for worldwide queries.
- Collection is intentionally slower now because it waits for each query paginator page turn before reading the next batch.
- The collector only sees what the live Google Trends page renders. If Google changes the widget structure, extraction can drift.
- The collector mutates the visible browser state while running. Do not use the same Chrome profile for unrelated browsing during collection.
- The collector does not bypass CAPTCHA or unusual-traffic interstitials. Human clearance is still required.
- Results can still be noisy because the first stage is purely trend-based. Use round 2 before deciding a keyword is worth building on.

## Failure Mapping

| Symptom | Next action |
| --- | --- |
| install problems | Rerun the correct install path from `references/install.md` and confirm the expected installed locations exist. |
| doctor failures | Fix environment prerequisites or Chrome Apple Events access, then rerun doctor before collecting again. |
| collection failures | Re-check compare-tab prep, CAPTCHA state, Apple Events access, and collector assumptions before rerunning the collector. |
| collection fails before reading any tab | Check Apple Events access, CAPTCHA state, and whether Chrome is on the expected profile. |
| extractor failures | Treat it as extractor drift or wrong page state. Re-check that the pages are true compare pages and inspect the vendored extractor before trusting output. |
| tabs are found but every page reports `no_data` | Treat it as extractor drift or wrong page state. Re-check that the pages are true compare pages and inspect the vendored extractor before trusting output. |
| collection succeeds but misses later rows | Confirm the page still shows `Next` buttons for `Related queries`, then re-run after checking for DOM drift or widget changes. |
| round-2 input/output problems | Rebuild the normalized helper output, then validate the keep/reject contract from `references/round2.md`. |
| unsure what to do next after a partial run | Use `workflow-next-step.mjs` to inspect artifact state, then decide whether the next move is `doctor`, `collect`, `round2`, or `report`. |
| keep/reject are done but the report is missing or inconsistent | Use `report-from-round2.mjs` to scaffold the report, then edit the result instead of freehanding the whole structure again. |

## Live Notes From The First Successful Run

- The first fully successful live run used ten manually prepared compare pages in `Worldwide / Past 7 days / All categories / Web Search`.
- Apple Events had to be enabled in Chrome before any live extraction succeeded.
- Once pagination was added, later pages contributed extra kept rows such as `kagi translate`, `pm sym pension scheme in hindi`, and additional `Constructor` queries beyond the first visible five rows.
