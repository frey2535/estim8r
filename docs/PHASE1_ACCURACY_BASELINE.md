# Phase 1 — takeoff accuracy baseline

Phase 1 audits the existing takeoff path, corrects the accuracy harness, and records a reproducible baseline. It does not change detection. No accuracy threshold below is a 99% claim.

## Architecture that was left in place

Drawing upload classifies sheets and keeps pdf.js objects out of React state. Legend and schedule pages supply symbol entries. `legendGeometry.js` clusters vector parts into prototypes and searches plan sheets for those shapes. `vectorSymbols.js` and `rasterSymbols.js` are separate candidate sources. `aiTakeoff.js` merges them, attaches nearby text, and emits count marks. `detectionRecord.js` keeps uncertain marks on a review layer so they do not roll into bid quantities. `deviceStyles.js` paints the marker from `symbolBodyLocation` when that point exists. Quantities, manual edits, estimates, and labor still read the accepted count marks. Supabase, company isolation, and Buildr sync are outside this measurement change.

## What was wrong with the measurement

- Empty or unmatched denominators were reported as 100% recall, precision, or placement. The pass flag rejected an empty fixture, but the printed percentages did not.
- A mark had to already carry the ground-truth type before it could count as a found symbol, so a wrong legend label became both a miss and a false positive. Classification was not its own number.
- Placement could pass because a marker was closer to a guessed body than to the type text, or because the label set the body center equal to the text.
- Pottsville “ground truth” is built with `shouldAcceptPlanToken`, the same filter the detector uses, and copies the token coordinate into the symbol center (`source: plan-token`).
- The expanded corpus then dropped false positives whose type was absent from that label set, which hid hundreds of extra bid marks.
- Soccer Pavilion labels come from printed type callouts on the extracted PDF plus a nearest-path guess (`scripts/extract-soccer-pavilion-fixture.py`). 118 of 129 labels put the symbol center on the type text. That is drawing-callout evidence, not a manual audit of symbol bodies.
- The original PDFs are not in this repository. The extractor still points at a local Downloads path, so Phase 1 cannot add a new sheet-by-sheet manual audit of those files.

## Harness rules now

`scoreDetections` matches a bid mark to a labeled device by location only. It then scores exact type, alias type, and whether the painted point sits inside the labeled symbol body. Ratios with a zero denominator are `unmeasured`, not 100%. A second mark on an already matched device is a double-count, not another quantity. Review-only marks stay out of precision and stay in the unresolved count.

`claimPermitted` is true only for `groundTruthIndependence: "manual"` when symbol recall, per-type exact recall, precision, and classification are each at least 99%, every match has a measured body, placement is at least 99%, unresolved review is empty, and the caller passes `coverageComplete: true`. None of the real drawing fixtures meet that bar.

## Reproducible baseline

Commands:

```bash
node src/domain/takeoff/accuracyGate.test.js
node src/domain/takeoff/phase1Regression.test.js
node src/domain/takeoff/soccerPavilionAccuracy.test.js
node src/domain/takeoff/pottsvilleAccuracy.test.js
node src/domain/takeoff/expandedCorpusAccuracy.test.js
```

| Set | Labels | Symbol recall | Exact classification | Precision | Placement | Claim |
| --- | --- | --- | --- | --- | --- | --- |
| Soccer Pavilion callouts (129 devices) | drawing-callout | 36/129 (27.91%) | 19/36 (52.78%), worst type 0% | 36/45 (80%), 9 double-counts | 10/11 measured bodies (90.91%); 25 matches have no separated body | not permitted |
| Soccer site E0.01 | drawing-callout | 0/2 | unmeasured | unmeasured (no bid marks) | unmeasured | not permitted |
| Soccer lighting E1.01 | drawing-callout | 31/95 (32.63%) | 14/31 (45.16%) | 77.50% | 90.91% of 11 measured | not permitted |
| Soccer power E2.01 | drawing-callout | 5/32 (15.63%) | 5/5 | 100% of 5 bid marks | unmeasured | not permitted |
| Pottsville OS/WP tokens | detector-derived | 15/15 | 15/15 | 5.08% (280 extra bid marks, 46 double-counts) | unmeasured | not permitted |
| Pottsville E110 glyphs | detector-derived | 5/8 | 5/5 | 17.24% | unmeasured | not permitted |
| Pottsville E210 type-2 cans | detector-derived | 12/12 | 12/12 | 13.64% | unmeasured | not permitted |
| Hand-labeled WP page | manual | 1/2 | 1/1 on the found symbol | 100% of 1 bid mark | the found marker is on the body | not permitted |

The hand-labeled page is the regression case for the reported failure modes: the tagged WP is found, the unlabeled repeat is missed, a wall crossing is not accepted, a highlight on the circuit number fails placement, a circuit number does not inherit the WP hover description, and zoom/pan samples stay finite. Hover behavior is also covered by `legendHover.test.js`.

Soccer still leaves 240 review-only marks. Pottsville OS/WP scoring leaves 311. Those marks do not add bid quantity, and they also mean the sheet is not bid-ready.

## Not claimed

- 99% symbol recall, per-type recall, precision, classification, or symbol-body placement.
- Bid-ready status for Soccer Pavilion or Pottsville.
- Coverage of residential, dedicated industrial, scanned, or low-quality drawings. Those classes are still listed as missing in `expandedCorpusAccuracy.test.js`.

## Remaining risk

The callout labels under-count devices that have no printed type, and they over-trust a nearest vector path when one is found. Pottsville token labels cannot prove recall. Phase 2 can change detection, but it should not be scored as 99% until a manual label set with separated symbol bodies exists.
