# Estim8r Existing-Code Elite Audit — Initial Baseline

Status: **IN PROGRESS — preliminary repository inspection, not a complete audit**.

## Verified source observations
| Area | Evidence | Status | Required verification |
|---|---|---|---|
| Imported labor library | README explicitly describes 1,921 imported labor rows as experimental/unverified and not production-ready; published NECA values are not populated | Release risk / requires verification | Inspect labor data sources, distinguish verified vs unverified entries in UI and exports, independently validate calculations and licensing |
| App architecture | package.json shows React/Vite, Supabase SDK, PDF.js, jsPDF, and no dedicated `test` script | Testing gap (test infrastructure not established from package scripts) | Inventory existing test files and CI, add repeatable unit/integration/e2e scripts and baseline tests |
| Crash recovery | src/App.jsx has RouteCrashBoundary and reload UI asserting saved takeoff/estimate data remain in browser | Recovery claim unverified | Test unsaved edits, autosave, local and remote persistence, corrupted storage, reload, cross-device behavior |
| Authentication/routes | src/App.jsx wraps application routes in ProtectedRoute and exposes /from-buildr, /admin, /takeoff, /markup, /estimates/new | Security unverified | Inspect authorization enforcement and Supabase RLS for every data path; validate company isolation and family SSO |
| Supplier pricing | README documents supplier API secrets and production edge-function flow, warns against invented prices | Runtime unverified | Inspect edge-function auth, source attribution, stale pricing, rate limits, errors, and CSV imports |

## Required full-scope inspection
- Drawing upload, parsing, rendering, pan/zoom, performance, and memory safety.
- Symbol detection and marking against representative labeled test plans (precision, recall, marking overlap, false positives).
- Legend matching, hover descriptions, manual edits, persistence across rescans.
- Circuit association, line identities, selection, grouping, colors, conduit routing, and PDF exports.
- Takeoff quantities, assemblies, labor hours, material prices, calculations, and traceability.
- Proposal designer, PDF generation, and revision comparison.
- Authentication, roles, tenant isolation, RLS, Buildr SSO and data exchange.
- Large-plan resilience, cancellation, recovery, cross-device consistency, and regression coverage.

## Status definitions
- VERIFIED: tested against approved criteria with recorded evidence.
- FAILING: reproducible defect with evidence.
- PARTIAL: functionality exists but does not meet approved requirements.
- UNTESTED: implementation or runtime behavior not yet verified.
- NOT APPLICABLE: documented rationale.

**No module should be marked VERIFIED merely because it is present in source code or described in README.**
