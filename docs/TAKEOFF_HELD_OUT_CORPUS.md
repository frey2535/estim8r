# Takeoff held-out accuracy corpus

Issue #246 requires an independent, multi-firm, held-out corpus with real vector and raster/scanned electrical sheets before Estim8r can claim >=99% production detection recall, classification precision, or symbol-body placement accuracy.

This repository now includes the corpus contract in `src/domain/takeoff/fixtures/held-out-corpus.manifest.json` and executable validation in `src/domain/takeoff/heldOutCorpus.js`.

## Non-fabrication rule

Do not add synthetic drawings, generated labels, token-derived labels, schedule quantities, or detector outputs as held-out ground truth. A project can enter the held-out corpus only when:

- The drawing file is a real project drawing set.
- Labels are independently human-verified.
- Every labeled device has type, sheet, symbol-body center, and symbol-body bounds.
- The project is not used for tuning detector thresholds, prototypes, prompts, or post-processing.
- The manifest records the firm/project partition and source label file.

## Required minimum coverage

- At least 3 held-out projects.
- At least 3 different firms.
- At least one vector PDF project.
- At least one real raster/scanned or flattened-raster project.
- Multiple legends, scales, rotations, crowded sheets, and device families.

## Current status

The manifest is intentionally `not-populated`. Existing Soccer Pavilion and Pottsville fixtures remain regressions, not sufficient held-out production evidence. The validator must continue to block production 99% claims until real projects and label files are added.

Run:

```bash
node src/domain/takeoff/heldOutCorpus.test.js
```

Expected current result: blocked, with explicit missing-corpus reasons.
