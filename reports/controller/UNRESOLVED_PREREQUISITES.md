# Estim8r unresolved prerequisites (cycle 1)

Do **not** fabricate ground truth, metrics, or green verification results.

## Verification environment

- Cursor CLI allowlist effectively permits `Shell(ls*)` only.
- `npm run lint|typecheck|build` and all `apps.json` `node …/*.test.js` commands return `Rejected` in this session.
- Primary controller paths under `~/AI-Autonomous-Runner/{tasks,logs,reports}/Estim8r*` could not be written (writes rejected); fallback copies live in this directory.

## AC-1 — rotation / calibration GT

- Unit coverage added in `src/lib/sheetViewport.js` + `src/lib/sheetViewport.test.js` for pan, pinch zoom, zoom-pan compensation, and synthetic 0/90/180/270 page-percent remaps.
- **Missing:** independent labeled PDF-page rotation / scale-calibration ground-truth fixture under `src/domain/takeoff/fixtures/`.
- Status: unresolved prerequisite (not fabricated).

## AC-2 / AC-3 — corpus / body-bound GT

Documented in `src/domain/takeoff/expandedCorpusAccuracy.test.js` as `MISSING_CORPUS_CLASSES`:

| id | reason |
| --- | --- |
| residential | No residential electrical drawing fixture in repo |
| industrial | No dedicated industrial set; Pottsville E111 only one printed WP token GT |
| raster-scanned | No scanned/flattened page fixture |
| low-quality | No poor CAD-export fixture |

Labeled fixtures that **do** exist (must be re-measured by running harnesses when shell allows):

- `src/domain/takeoff/fixtures/soccer-pavilion-electrical.json`
- `src/domain/takeoff/fixtures/pottsville-electrical.json`
- `src/domain/takeoff/fixtures/pottsville-cover.json`

E111 remaining devices beyond the single printed WP: no coordinate ground truth (see expanded corpus test log line).

## AC-4 — legend GT

Legend geometry unit tests exist (`legendGeometry.test.js`). Drawings without verified legend entry GT remain unresolved; do not invent legend labels.

## AC-5 — overlay UI evidence

Domain tests: `overlayLayout.test.js`, `deviceFillVisibility.test.js`. Isolation mode UI: `TakeoffInspector` “Isolate selected”. Mobile/UI screenshot evidence not captured this cycle (shell + interactive UI blocked).

## AC-7 — mobile ground-truth scenarios

Pinch math covered in `sheetViewport.test.js`. TakeoffWorkspace now wires multi-pointer pinch (parity with MarkupPages). Missing: recorded device/mobile scenario fixtures or screenshot suite.

## AC-8

Blocked until Shell allowlist permits `npm` / `node` and exit codes can be captured.
