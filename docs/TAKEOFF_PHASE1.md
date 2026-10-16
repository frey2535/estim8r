# Phase 1 — Takeoff architecture audit and labeled baseline

No production deploy. No `origin/main` push. No Supabase db push. Owner review required before any production change.

## Architecture (preserved)

Takeoff still runs through the existing pipeline. This phase does not rewrite detectors.

1. **Upload / page read** — `drawingUpload.js`, `aiPages.js`, `TakeoffWorkspace.jsx`  
   Large/scanned PDFs take a chunked read. Live `pdf.js` page objects are stripped before React state (`persistableAiPages`).
2. **Sheet gating** — `drawing-docs.js`, `sheetDiscipline.js`, `aiTakeoff.pagesToScan`  
   Cover, index, legend, schedule, riser, and other-trade sheets stay out of the plan scan.
3. **Legend learning** — `legendGeometry.js`  
   Project legend entries become prototypes. The drawing legend is the highest authority when geometry exists.
4. **Detection** — `aiTakeoff.buildAiMarks`  
   Token match → exclusive geometry → visual legend scan → unlabeled repeats → review hits → legend recovery → optional raster.  
   Electrical-only raster hydration and time budgets remain in place so large CAD sets do not crash the tab.
5. **Classification / evidence** — `detectionRecord.js`, `takeoffQuality.classifyAiEvidence`  
   Bid marks need detector agreement. Uncertain items stay `UNKNOWN` / review and are excluded from `bidDeviceMarks` and rollup counts.
6. **Marking / hover** — `deviceStyles.js`, `legendHover.js`, `overlayLayout.js`  
   Fills use `symbolBodyLocation` / `symbolBodyBounds`. Hover names the locked legend code, description, and fixture type.
7. **Counts / estimate** — `quantities.js`, `countReconciliation.js`, `fromTakeoff`  
   Schedule qty is never copied into installed qty. Conduit routing does not change device counts.
8. **Review / bid-ready** — `accuracyReview.js`, `sheetCoverage.js`  
   A blank sheet is not complete. Unscanned regions stay unresolved.

User data paths (Supabase, estimate store, uploaded PDFs) are unchanged.

## Harness corrections

`scoreTakeoffAccuracy` now records label authority and will not pass a 99% claim unless:

- ground truth is **independently labeled** (class + sheet + position + body + quantity ≥ 8)
- recall, worst-type recall, unfiltered precision, classification, and marker placement are all ≥ 99%

Authorities:

| Authority | Meaning | Can claim 99%? |
|---|---|---|
| `independent` | Human-labeled devices with class, position, quantity | Only if metrics also meet 99% |
| `derived-tokens` | Printed plan tags / glyph filters | No |
| `synthetic` | Hand-built stub (the one-device WP fixture) | No |
| `none` | Empty fixture | No |

Unfiltered bid extras stay in `detectionPrecision`. A typed subset can still be reported as `typedPrecision` so OS/WP regressions are not hidden, but typed 100% is not a 99% claim.

## Measured baseline (this branch)

Independent commercial set — Soccer Pavilion, 129 labeled devices:

| Metric | Value |
|---|---|
| Recall | **15.50% (20/129)** |
| Worst type | **0.00%** (types 1, 2, 4, 2E, F, GFI/WP, VF all 0) |
| Precision | **44.44% (FP 25)** |
| Classification | **44.44%** (25 wrong-type near a labeled body) |
| Marker placement | **90.00%** (2 of 20 matches off body) |
| Hover on matches | **100.00%** |
| Wall extras | **0** among the 25 extras |
| Unresolved review | **240** |
| 99% claim | **not permitted** |

Per-type recall: 1 0/15, 2 0/20, 3 4/13, 4 0/11, OS 2/13, 1E 7/7, 3E 2/5, 2E 0/8, F 0/3, GFI 4/24, GFI/WP 0/6, VF 0/1, EF 1/3.

Sheet slices: site 0/2, lighting 15/95, power 5/32.

Derived-token regression (Pottsville printed OS/WP, not an independent 99% set):

| Metric | Value |
|---|---|
| Typed recall | 15/15 (WP 6/6, OS 9/9) |
| Typed extras | 0 |
| Unfiltered precision | **5.08% (FP 280)** |
| Classification | 24.59% (46 wrong-type) |
| Marker / hover on the 15 | 100% |
| 99% claim | **not permitted** |

Synthetic WP stub: 1/1 recall and precision. **99% claim not permitted.**

Zoom / pan: pixel budget OK, pinch stays in 0.25–8, `stressZoomPan` OK. No crash in the math/budget regressions. Live 76-page Pottsville takeoff was not re-run in a browser in this phase.

## Unresolved (Phase 2+)

- Soccer misses 109 of 129 labeled devices, including every type 1 / 2 / 4 / 2E / F / GFI/WP / VF.
- 25 Soccer extras and 2 markers off body.
- Pottsville still emits 280 unfiltered bid extras against a 15-token OS/WP slice.
- No residential, industrial, raster-scanned, or low-quality labeled fixtures in the repo.
- Soccer bodies are tag-centered 0.9 boxes on many occupancy/fixture labels, not CAD-traced outlines.
- `legendGeometry` recovery tests still fail on the 0.90 `#224` threshold (pre-existing).
- Pages `deploy-pages` timeout is clamped by GitHub to 600s (warning only).

## Risks

- Locking Soccer at 20/129 will fail CI if detection changes without updating the baseline on purpose.
- Typed Pottsville 15/15 can still look “perfect” if someone reads only `typedPrecision`. The report now prints unfiltered precision beside it.
- Phase 2 detection work must not drop the crash-fix budgets or review-only unknown handling.

## How to remeasure

```bash
node src/domain/takeoff/takeoffBaseline.test.js
node src/domain/takeoff/soccerPavilionAccuracy.test.js
node src/domain/takeoff/pottsvilleAccuracy.test.js
```
