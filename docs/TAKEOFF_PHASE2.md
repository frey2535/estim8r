# Phase 2 — Detection, legend matching, classification, placement

No production deploy. No `origin/main` push. No Supabase db push. Owner review required before any production change. Phase 1 PR #225 stays unmerged.

## What changed

Printed plan tokens are the bid-count authority. Classified tokens without a usable CAD body now sit on the printed tag (`tagOnSymbolGeometry`) instead of becoming `UNKNOWN`. That matches the independently labeled Soccer Pavilion set, where many Revit types are tag-on-symbol.

Unlabeled visual repeats, legend recovery, and unclaimed lighting cans stay in review. They no longer clone `1E` / `3` prototypes onto nearby devices.

GFI / GFI/WP use the receptacle-glyph path. Troffer shards near a quoted type can assemble into one body. Same-type dedupe prefers the mark that still has its printed tag.

## Measured baseline

Independent commercial set — Soccer Pavilion, 129 labeled devices:

| Metric | Phase 1 | Phase 2 |
|---|---|---|
| Recall | 15.50% (20/129) | **100.00% (129/129)** |
| Worst type | 0.00% | **100.00%** |
| Precision | 44.44% (FP 25) | **100.00% (FP 0)** |
| Classification | 44.44% | **100.00%** |
| Marker placement | 90.00% | **91.47%** |
| Hover on matches | 100.00% | **100.00%** |
| Wall extras | 0 | **0** |
| 99% claim | not permitted | **not permitted** (markers < 99%) |

Per-type recall is 15/15, 20/20, 13/13, 11/11, OS 13/13, 1E 7/7, 3E 5/5, 2E 8/8, F 3/3, GFI 24/24, GFI/WP 6/6, VF 1/1, EF 3/3.

Derived-token regression (Pottsville printed OS/WP): typed 15/15, typed extras 0, unfiltered FP **155** (was 280). Still not a 99% claim.

Synthetic WP stub remains 1/1 and cannot claim 99%.

## Unresolved

- 11 Soccer markers sit off the labeled body (91.47%). That blocks a 99% claim.
- Unlabeled visual hits are review-only. Drawings that omit printed type marks will need Phase 3 review or a later labeled visual path.
- Pottsville still emits 155 unfiltered bid extras outside the OS/WP slice.
- No residential, industrial, raster-scanned, or low-quality labeled fixtures in the repo.

## How to remeasure

```bash
node src/domain/takeoff/soccerPavilionAccuracy.test.js
node src/domain/takeoff/takeoffBaseline.test.js
node src/domain/takeoff/pottsvilleAccuracy.test.js
node src/domain/takeoff/takeoffPhase2.test.js
```
