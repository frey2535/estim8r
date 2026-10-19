# Issue 246 takeoff accuracy audit

## Scope audited

- Symbol/text classification: `src/domain/takeoff/symbolDetection.js`
- Vector recognition and symbol geometry: `src/domain/takeoff/vectorSymbols.js`, `src/domain/takeoff/legendGeometry.js`
- Raster recognition and reconciliation: `src/domain/takeoff/rasterSymbols.js`
- Detection records, body/text separation, and bid-count filtering: `src/domain/takeoff/detectionRecord.js`
- Accuracy scoring and ground-truth authority checks: `src/domain/takeoff/accuracyHarness.js`, `src/domain/takeoff/labeledTruth.js`
- Overlay rendering, fill boundaries, and selection surfaces: `src/domain/takeoff/deviceStyles.js`, `src/domain/takeoff/drawingObjectLayer.js`
- End-to-end pipeline: `src/domain/takeoff/aiTakeoff.js`, `src/domain/takeoff/takeoffPipeline.js`, `src/pages/TakeoffWorkspace.jsx`
- Independent held-out corpus gate: `src/domain/takeoff/heldOutCorpus.js`, `src/domain/takeoff/fixtures/held-out-corpus.manifest.json`, `docs/TAKEOFF_HELD_OUT_CORPUS.md`

## Findings

1. `recoverMissedLegendSymbols()` filtered entries by sheet plan family before creating review candidates. That dropped repeated legend geometry when a sheet carried mixed electrical content or when plan classification was narrower than the legend entry family. This is a recall risk because recovery candidates are review-only and should retain detector disagreement rather than disappear.
2. `planOverlayMarks()` allowed `requiresReview` detections into the normal bid drawing overlay. Text-only and detector-disagreement marks then appeared as counted devices even when `displayDeviceOutline()` correctly refused to paint an invented body.
3. The current repository fixtures are not sufficient to demonstrate the issue's full acceptance contract. Soccer Pavilion has independent labels and currently scores at threshold in the harness. Pottsville contains useful regressions but several truth sets are derived from tokens, not independent body-labeled ground truth, so the harness correctly blocks a 99% claim.
4. No real scanned/flattened raster ground-truth fixture exists in the repository. `rasterReconcile.test.js` exercises synthetic raster candidates only.
5. Pottsville E110 receptacle glyphs were detected by `scanUnlabeledPowerGlyphs()` but were not promoted to typed bid marks because the downstream review path kept them as UNKNOWN candidates, filtered right-side plan-interior glyphs as title-band content, and allowed nearby UNKNOWN review candidates to suppress typed recovery.
6. The independent held-out corpus requirement is now executable and intentionally blocked until real multi-firm vector and raster/scanned body-labeled projects are added.

## Changes in this branch

- Per-legend recovery now allows cross-family entries only for recovery/review scans. The primary accepted detection pass remains plan-family gated.
- Normal overlay rendering now excludes `requiresReview` marks so uncertain candidates remain in review instead of being painted on the bid drawing.
- Trusted unlabeled power receptacle glyphs now become body-backed `R` marks and can replace overlapping UNKNOWN review candidates.
- Review-required text-only specialty tags remain review-visible without being painted on the normal bid overlay; missing printed specialty tokens are recovered only on scannable plan sheets, not legends or schedules.
- Raw AI device outlines are capped to the trusted glyph fill extent so highlights stay within the symbol body.
- Added the versioned held-out corpus manifest, validation module, and documentation. The manifest is intentionally empty rather than populated with fake drawings.

## Current measured status

Latest focused measurements from this branch:

- `node src/domain/takeoff/legendGeometry.test.js`: pass
- `node src/domain/takeoff/deviceFillVisibility.test.js`: pass, `112/112` visible in-symbol fills after hiding review-required marks from normal overlays
- `node src/domain/takeoff/e110PowerAccuracy.test.js`: pass, E110 receptacle glyphs `8/8`, SP `21/21`, extras `0`, max extent `0.95`
- `node src/domain/takeoff/e210LightingAccuracy.test.js`: pass, type-2 cans `12/12`, labeled plan `24/24`
- `node src/domain/takeoff/expandedCorpusAccuracy.test.js`: pass overall, including Pottsville E110 `R 8/8`; only Soccer fixtures have independent authority, so Pottsville and skipped classes do not permit a 99% production claim
- `node src/domain/takeoff/heldOutCorpus.test.js`: pass, confirms production 99% claims stay blocked until the held-out corpus is populated

## Release blockers for issue 246

- Populate `src/domain/takeoff/fixtures/held-out-corpus.manifest.json` with real independent ground-truth projects covering multiple firms, vector PDFs, scanned/raster sheets, varied legends, rotations, scales, crowded plans, and held-out partitions.
- Convert remaining text-only review-required specialty counts into body-backed symbols where drawing geometry exists, or keep them review-only when no body can be recovered.
- Add real raster-scanned body-labeled fixtures and run the raster recognizer against them.
- Re-run full lint, typecheck, production build, focused takeoff tests, and benchmark suite after each correction.
- Do not merge or claim 99% accuracy until independent held-out metrics show >=99% recall per type, >=99% precision, and >=99% body placement with sample sizes disclosed.
