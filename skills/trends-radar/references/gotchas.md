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
