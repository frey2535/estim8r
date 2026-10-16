# Phase 3 — Professional review tools

No production deploy. No `origin/main` push. Phase 1 #225 and Phase 2 #226 stay unmerged.

## What changed

Domain review commands now live in `professionalReview.js`:

- accept / reject / reclassify / move / resize / add
- inspect by type (`marksOfType`, `inspectTypes`, `filterMarksByInspect`)
- hover bound to the matching legend entry (`hoverBoundToLegend`)
- revision compare (`added`, `removed`, `moved`, `reclassified`)

The workspace type-color chips filter the overlay to one type. Hover uses the enriched legend fields so the tooltip names the locked legend code.

Manual tools, estimates, labor, project data, and bid rollup of rejected/unknown marks are unchanged.

## Verification

```bash
node src/domain/takeoff/professionalReview.test.js
node src/domain/takeoff/soccerPavilionAccuracy.test.js
```

Soccer Pavilion Phase 2 numbers stay 129/129, FP 0, markers 100%. The independently labeled set now supports a 99% claim.
