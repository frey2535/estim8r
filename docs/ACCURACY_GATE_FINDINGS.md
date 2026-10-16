# Accuracy harness findings

The previous scorer treated an empty ground-truth set as 100% recall, precision, and placement. It also required a type match before a symbol counted as found, and several fixtures built their labels with the detector’s own token and glyph filters.

`src/domain/takeoff/accuracyHarness.js` now returns `unmeasured` when a denominator is zero, matches on location first, and reports classification, placement, and double-counts separately. A passing claim requires manual labels, measured bodies, the 99% ratios, no unresolved review marks, and an explicit coverage pass. Drawing-callout and detector-derived fixtures cannot pass that gate.

Measured results are in `docs/PHASE1_ACCURACY_BASELINE.md`. No 99% accuracy claim is supported.
