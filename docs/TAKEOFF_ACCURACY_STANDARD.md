# Estim8r Takeoff Accuracy Standard

Estim8r takeoff is designed for bid-critical electrical drawings. The system must optimize for recall and transparent verification rather than silently treating missed detections as zero quantity.

## Required analysis sequence

1. Render every drawing sheet at multiple resolutions and preserve vector/text content when available.
2. Classify sheet discipline, title, revision, scale, legends, schedules, notes, one-lines and plan regions.
3. Extract drawing text and equipment/circuit tags.
4. Build a project-specific symbol dictionary from legends before final symbol classification.
5. Run multiple independent symbol passes: geometry/vector candidates, raster visual candidates, text/context candidates and project-legend matching.
6. Merge overlapping candidates without discarding disagreement. Detector disagreement becomes a review item.
7. Scan the complete drawable sheet area and record coverage. Unscanned/unreadable areas block verification.
8. Cross-check plan detections against legends, schedules, panel schedules, equipment schedules, notes and repeated floor/room patterns when applicable.
9. Reconcile counts by category and subtype. Count discrepancies remain visible until resolved.
10. Route circuits/conduit only from accepted electrical context. Routing must never change device counts.
11. Produce marked sheets so every accepted count can be visually audited.
12. Block bid-ready status until every sheet is verified and no blocking review item remains.

## Detection policy

There is no global confidence threshold that silently deletes a candidate.
- High-confidence candidates may be pre-accepted only after detector/context agreement rules are satisfied.
- Medium-confidence candidates are visible and require review.
- Low-confidence candidates remain visible as unresolved candidates/regions rather than disappearing.
- Unknown symbols are retained as unknowns and presented for classification.
- A blank result is not proof that a sheet contains no devices.

## Readability policy

Poor resolution, clipping, rotation, raster artifacts, unreadable legends or incomplete rendering create blocking review regions. The system asks for a better source drawing or manual verification rather than returning a deceptively complete takeoff.

## Bid safety

The server-side takeoff project verification function is the completeness gate. A project cannot be considered verified while any sheet lacks verification, a sheet was not fully scanned, blocking review regions remain open, or category count reconciliations remain unresolved.
No UI label such as Complete, Verified, Bid Ready, Export Final or Send to Estimate should bypass this gate.

## Accuracy measurement

Production accuracy must be measured against human-verified ground-truth drawing sets by symbol/category and drawing type. Track precision, recall, false negatives, false positives, manual additions and corrections. False negatives are the primary bid-risk metric and must be surfaced separately from aggregate accuracy.