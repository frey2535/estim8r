# Issue 246 takeoff accuracy audit

## Scope audited

- Symbol/text classification: `src/domain/takeoff/symbolDetection.js`
- Vector recognition and symbol geometry: `src/domain/takeoff/vectorSymbols.js`, `src/domain/takeoff/legendGeometry.js`
- Raster recognition and reconciliation: `src/domain/takeoff/rasterSymbols.js`
- Detection records, body/text separation, and bid-count filtering: `src/domain/takeoff/detectionRecord.js`
- Accuracy scoring and ground-truth authority checks: `src/domain/takeoff/accuracyHarness.js`, `src/domain/takeoff/labeledTruth.js`
- Overlay rendering, fill boundaries, and selection surfaces: `src/domain/takeoff/deviceStyles.js`, `src/domain/takeoff/drawingObjectLayer.js`
- End-to-end pipeline: `src/domain/takeoff/aiTakeoff.js`, `src/domain/takeoff/takeoffPipeline.js`, `src/pages/TakeoffWorkspace.jsx`

## Findings

1. `recoverMissedLegendSymbols()` filtered entries by sheet plan family before creating review candidates. That dropped repeated legend geometry when a sheet carried mixed electrical content or when plan classification was narrower than the legend entry family. This is a recall risk because recovery candidates are review-only and should retain detector disagreement rather than disappear.
2. `planOverlayMarks()` allowed `requiresReview` detections into the normal bid drawing overlay. Text-only and detector-disagreement marks then appeared as counted devices even when `displayDeviceOutline()` correctly refused to paint an invented body.
3. The current repository fixtures are not sufficient to demonstrate the issue's full acceptance contract. Soccer Pavilion has independent labels and currently scores at threshold in the harness. Pottsville contains useful regressions but several truth sets are derived from tokens, not independent body-labeled ground truth, so the harness correctly blocks a 99% claim.
4. No real scanned/flattened raster ground-truth fixture exists in the repository. `rasterReconcile.test.js` exercises synthetic raster candidates only.
5. Existing E110 power regressions still expose unresolved failures: the harness reports 0/8 Pottsville E110 receptacle-glyph recall, and `e110PowerAccuracy.test.js` still fails on text-only counted marks and missed SP expectations.

## Changes in this branch

- Per-legend recovery now allows cross-family entries only for recovery/review scans. The primary accepted detection pass remains plan-family gated.
- Normal overlay rendering now excludes `requiresReview` marks so uncertain candidates remain in review instead of being painted on the bid drawing.

## Current measured status

Latest focused measurements from this branch:

- `node src/domain/takeoff/legendGeometry.test.js`: pass
- `node src/domain/takeoff/deviceFillVisibility.test.js`: pass, `104/104` visible in-symbol fills after hiding review-required marks from normal overlays
- `node src/domain/takeoff/e210LightingAccuracy.test.js`: pass, type-2 cans `12/12`, labeled plan `24/24`
- `node src/domain/takeoff/expandedCorpusAccuracy.test.js`: pass overall, but only Soccer fixtures have independent authority; Pottsville and skipped classes do not permit a 99% production claim
- `node src/domain/takeoff/e110PowerAccuracy.test.js`: fail; remaining E110 failures must be fixed before issue 246 can close

## Release blockers for issue 246

- Establish a versioned independent ground-truth corpus covering multiple firms, vector PDFs, scanned/raster sheets, varied legends, rotations, scales, crowded plans, and held-out projects.
- Fix Pottsville E110 body-backed receptacle recovery and SP text/body disagreement without inflating bid counts from text-only fallbacks.
- Add real raster-scanned body-labeled fixtures and run the raster recognizer against them.
- Re-run full lint, typecheck, production build, focused takeoff tests, and benchmark suite after each correction.
- Do not merge or claim 99% accuracy until independent held-out metrics show >=99% recall per type, >=99% precision, and >=99% body placement with sample sizes disclosed.
