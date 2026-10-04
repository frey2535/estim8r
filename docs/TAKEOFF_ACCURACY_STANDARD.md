# Estim8r Takeoff Accuracy Standard

Estim8r takeoff is designed for bid-critical electrical drawings. The system must optimize for recall and transparent verification rather than silently treating missed detections as zero quantity.

Do **not** replace working functionality with a simplified implementation. Inspect and improve the existing takeoff architecture.

Relevant files include:

- `src/domain/takeoff/aiTakeoff.js`
- `src/domain/takeoff/symbolDetection.js`
- `src/domain/takeoff/vectorSymbols.js`
- `src/domain/takeoff/rasterSymbols.js`
- `src/domain/takeoff/legendGeometry.js`
- `src/domain/takeoff/deviceStyles.js`
- `src/domain/takeoff/overlayLayout.js`
- `src/domain/takeoff/accuracyHarness.js`
- `src/domain/takeoff/detectionRecord.js`
- `src/pages/TakeoffWorkspace.jsx`

## Required analysis sequence

1. Classify sheets.
2. Identify legends/schedules and extract project-specific symbol geometry.
3. Search applicable plan sheets for those symbols.
4. Run independent vector detection.
5. Run independent raster/visual detection when a render is available.
6. Merge overlapping candidates without discarding disagreement.
7. Associate nearby text, tags, and circuit numbers.
8. Classify the device.
9. Mark the actual symbol body.
10. Reconcile plan counts against legends/schedules without treating schedule qty as installed qty.
11. Flag uncertain, disagreed, or unscanned areas for review.
12. Block bid-ready status until every sheet is verified and no blocking review item remains.

Routing circuits/conduit only from accepted electrical context. Routing must never change device counts.

## Detection policy

There is no global confidence threshold that silently deletes a candidate.

- High-confidence candidates may be pre-accepted only after detector/context agreement rules are satisfied.
- Medium-confidence candidates are visible and require review.
- Low-confidence candidates remain visible as UNKNOWN / REVIEW rather than disappearing.
- Unknown symbols are retained as unknowns and presented for classification.
- A blank result is not proof that a sheet contains no devices.
- Architectural chrome (hatch, hex notes, title blocks, plot stamps) is not a candidate and may stay dropped.

**Core rule: NOT DETECTED DOES NOT MEAN DOES NOT EXIST.**

False negatives are the primary estimating risk.

## Symbol location vs text location

Text, tags, circuit numbers, fixture type numbers and abbreviations may help **classify** a detected symbol. The marker/highlight position must come from the physical symbol geometry or visual symbol body.

Every detection must distinguish:

- `symbolBodyLocation`
- `symbolBodyBounds`
- `labelLocation`
- `circuitTagLocation`
- `visualMatchScore`
- `vectorMatchScore`
- `legendMatchScore`
- `textContextScore`
- `combinedConfidence`
- `detectionSources`
- `requiresReview`
- `reviewReason`

The colored marker **must** use `symbolBodyLocation` / `symbolBodyBounds`.

Never paint a bid device at OCR/text-token coordinates unless the text is physically part of the symbol and that has been positively established. A classified token with no recovered body stays a review candidate, not a deleted count.

## Project-specific legend learning

When a drawing contains an electrical symbol legend:

- Extract the actual graphical symbol for each legend entry.
- Create multiple prototypes per device type when possible.
- The drawing's own legend has the highest authority.

## Vector and raster detection

For vector PDFs, search actual PDF geometry: line/path arrangement, curves, circles, rectangles, internal patterns, aspect ratio, and relative geometry.

A separate raster pass searches rendered sheets for visual matches. Do not silently discard lower-confidence candidates from that pass.

## Mark the actual symbol

Highlight centered on and contained within the graphical device. Do not mark fixture type text, circuit numbers, keynotes, annotations, leaders, room text, or schedule text. The original symbol must remain readable.

## Adaptive scale

Detection radii, clustering, size tolerance, and text-association distance adapt to page dimensions, drawing scale, typical symbol size on that sheet, legend prototype dimensions, and render resolution.

## False-positive protection

Architectural geometry must not become electrical devices: hatch, stairs, grid bubbles, dimensions, keynotes, detail/section refs, title blocks, room labels, revision clouds, furniture, wall intersections.

Cover, legend, and schedule sheets stay at 0 counted devices.

## Complete sheet coverage

Track whether every applicable region of every electrical plan sheet was analyzed. Unanalyzed regions become unresolved review regions.

Never report a sheet complete merely because no additional devices were detected.

## Review system

Queue: low-confidence, detector disagreements, unknown repeats, unreadable areas, ambiguous classification, count discrepancies, unmatched legend symbols, unscanned regions.

User can accept, reject, change type, move marker, resize/correct bounds, or manually add a missed device.

## Bid safety

The server-side takeoff project verification function is the completeness gate. A project cannot be considered verified while any sheet lacks verification, a sheet was not fully scanned, blocking review regions remain open, or category count reconciliations remain unresolved.

No UI label such as Complete, Verified, Bid Ready, Export Final or Send to Estimate should bypass this gate.

## Accuracy measurement

Do not use one broad "accuracy" number. Track separately: device recall, precision, symbol-body placement accuracy, per-type recall, FP, FN, unresolved candidates, unscanned regions.

Production accuracy must be measured against human-verified ground-truth drawing sets. Target: ≥99% recall per device type, ≥99% precision, ≥99% symbol-body placement — **only if validated against ground truth. Do not fake or claim 99% in the UI otherwise.**

Keep Pottsville and Soccer Pavilion regressions. Fail when: device missed, extra bid device, wrong type, marker on text, partial/wrong highlight, applicable sheet region never scanned.

Review-only UNKNOWN marks are not bid devices and must not inflate persisted counts, precision extras, or schedule reconciliation.

## Do not break existing Estim8r features

Preserve manual takeoff, upload, PDF render, estimates, labor, quantities, device colors, conduit, circuits, Current Flow identity, `company_id` / org isolation, Supabase RLS, standalone Estim8r, and future Buildr sync. Estim8r must work without Buildr.

## Implementation process

First audit the complete existing detection pipeline. Then upgrade incrementally. Do not rewrite working modules unnecessarily.

After implementation: run existing tests and the accuracy suite. Report exact recall, precision, marker-placement, remaining FN/FP, and unresolved review candidates. Do not declare 100% accurate. Do not hide failing tests.
