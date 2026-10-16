# Phase 1 accuracy notes

PR #229 merged a second `scoreTakeoffAccuracy` into the harness that Phases 2–4 already used. The merged file did not parse: `const extraMarks` was declared twice, and the second function called `scoreDetections`, which that file does not define. CI stopped at `SyntaxError: Identifier 'extraMarks' has already been declared` in `src/domain/takeoff/accuracyHarness.js`.

This repair keeps one `scoreTakeoffAccuracy`. It is the scorer from the commit before that merge. Bid marks match labeled devices by sheet, type, and location. The result reports recall, precision, typed precision, classification, marker placement, and hover. `canClaimThreshold` is true only when the label authority and ground-truth inspection allow a claim and recall, worst-type recall, precision, classification, and marker placement are each at least 99%.

An empty fixture still uses 1 when a denominator is zero. It cannot claim 99%, because `inspectGroundTruth` rejects empty labels and `canClaimThreshold` stays false.

The 36/129 Soccer table from the unmerged Phase 1 branch is not what this function returns. Current locks are the CI scripts: Soccer Pavilion 129/129 may set `canClaimThreshold`, and Pottsville token labels may not.
