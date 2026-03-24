# Collect Reference

Use this reference after doctor passes and before running the OpenCLI collector.

## Compare-tab preparation rules

- Every compare tab must use the same geo, time, category, and search property.
- Leave each tab on a Google Trends `explore` result, not the Trends home page.
- Collect only from tabs that are already open in desktop Google Chrome on macOS.

## Manual CAPTCHA handling

- Resolve any CAPTCHA or unusual-traffic interstitial manually.
- Do not start the collector until the page is back on the compare results view.

## Merge and dedupe semantics

- Round-1 collection should merge and dedupe repeated keywords across prepared tabs.
- Preserve the combined seed list so later review can see which compare tabs produced the keyword.

## Collector limitations and known assumptions

- The collector limitations are tied to the current Google Trends DOM and Chrome automation behavior.
- The collector assumes the current Google Trends DOM matches the vendored extractor.
- It does not prepare tabs for the user; the human must stage the compare pages first.
- It depends on Apple Events control of Chrome and can fail when browser automation permission is missing.
