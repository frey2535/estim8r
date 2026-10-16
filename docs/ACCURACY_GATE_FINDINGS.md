# Accuracy harness findings

Review of `src/domain/takeoff/accuracyHarness.js` found that the current accuracy pass conditions can evaluate as true with an empty ground-truth fixture because the fallback recall, precision, and placement values are 1. The detection gate also checks worst-type recall and precision without separately requiring overall recall. These are verification risks, not proof of poor detection performance.

Required correction: a passing score must require nonempty independently labeled ground truth, overall recall and per-type recall at the required threshold, precision at threshold, and marker placement against matched devices. Add false-negative count to the report. Preserve the existing fixture scoring API and run existing regressions before merge.

No 99% accuracy claim is supported by this inspection alone.
