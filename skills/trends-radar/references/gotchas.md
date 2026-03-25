# Gotchas

This file should capture real observed failures and should grow only when the workflow hits another concrete issue.

## Observed failure modes

- OpenCLI daemon or bridge instability can break browser control even when the plugin is installed correctly.
- Chrome Apple Events JavaScript disabled will cause doctor and collection to fail until the Chrome developer setting is re-enabled.
- mismatched compare-tab scope leads to misleading merges and invalid comparisons.
- CAPTCHA or unusual-traffic interstitials block extraction until the human clears them manually.
- live extractor DOM drift can break selectors even on a correctly prepared page.
- repeated seed overlap and result-merge confusion can make duplicate rows look like distinct findings.
- round-2 false positives and false negatives show up when first-stage context is weak or overly event-driven.
- open-source project keywords can look like brand or repo navigation queries while still supporting independent siteable demand; do not auto-kill them without checking for tutorial, template, plugin, community, case-study, or alternatives angles.
- `pascal editor` was a real example of this failure mode: treating it as a generic navigational reject would have missed the chance that an open-source project can still generate tutorial and ecosystem demand.
- reading `windows[0].activeTab()` is not safe when multiple Chrome windows are open; the collector must execute against the exact window/tab pair it enumerated.
- returning full page HTML through Apple Events can overflow the `osascript` stdout buffer; extractor payloads must stay bounded and text-first.
- a valid worldwide compare page will still emit `geo: ""` in the normalized scope because Google Trends omits `geo` for worldwide URLs.
- successful pagination depends on the per-seed `Next` buttons that sit under `Showing 1–5 of N queries`; if those controls disappear or change, later pages will silently stop advancing.
- over-automation can create false confidence: `workflow-next-step.mjs` and `report-from-round2.mjs` should reduce reconstruction cost, not encourage blind trust in the current artifacts.
