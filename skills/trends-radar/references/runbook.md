# Runbook

Use this file to map the current symptom to the next remediation step without improvising a new workflow.

| Symptom | Next action |
| --- | --- |
| install problems | Rerun the correct install path from `references/install.md` and confirm the expected installed locations exist. |
| doctor failures | Fix environment prerequisites or Chrome Apple Events access, then rerun doctor before collecting again. |
| collection failures | Re-check compare-tab prep, CAPTCHA state, and collector assumptions before rerunning the collector. |
| extractor failures | Treat the issue as DOM drift or browser-state breakage and inspect the vendored extractor before trusting output. |
| round-2 input/output problems | Rebuild the normalized helper output, then validate the keep/reject contract from `references/round2.md`. |
