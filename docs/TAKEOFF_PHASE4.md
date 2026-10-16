# Phase 4 — Performance and end-to-end pipeline

No production deploy. No `origin/main` push. Phase 1–3 PRs stay unmerged.

## What changed

- Regional tiles + bounded worker jobs for dense sheets
- LRU page cache with a hard byte/entry budget
- Large-drawing navigability check (existing pixel/zoom/memory budget + regional plan)
- Domain pipeline: upload (strip live `pdfPage`) → detect → review commands → quantities → estimate lines → marked-PDF spec

The Node test does not render a browser PDF. It proves the payload `buildMarkedDrawingPdf` would print: title, page count, bid marks, ready flag.

Manual tools, estimates, labor, project data, Supabase security, and company isolation are unchanged.

## Verification

```bash
node src/domain/takeoff/takeoffPhase4.test.js
node src/domain/takeoff/soccerPavilionAccuracy.test.js
```

Soccer Pavilion remains 129/129, FP 0, markers 91.47%. 99% claim not permitted.
