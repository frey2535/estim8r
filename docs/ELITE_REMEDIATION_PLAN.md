# Estim8r Legacy Remediation Plan

Status: **INITIAL PLAN — implementation and testing not yet completed**.

## Release gate 0 — Establish trustworthy baseline
1. Inventory all source modules, Supabase migrations/functions, and CI workflows.
2. Identify existing tests and add repeatable `npm` test commands and CI evidence where missing.
3. Capture reproducible baseline for zoom crashes, AI marking failures, incorrect hover labels, and persistence.
4. Inspect tenant isolation and authorization boundaries before any data migrations.

## Release gate 1 — Correctness and safety
1. Ensure unverified imported labor units cannot silently appear as authoritative production estimates; preserve data and flag provenance.
2. Verify and repair takeoff/estimate save and crash recovery claims.
3. Validate every price source and reject fabricated or stale prices without disclosure.
4. Add deterministic validation for quantities and calculations.

## Release gate 2 — Drawing and circuit architecture
1. Build persistent circuit/segment/object identity independent of rendering color.
2. Implement selection, manual edits, per-segment overrides, circuit-wide propagation, layer controls, undo/redo, and export.
3. Preserve verified user corrections through AI reruns and document reload.
4. Validate performance on large representative PDFs.

## Release gate 3 — AI accuracy
1. Assemble representative labeled drawings and exact symbol/legend ground truth.
2. Measure precision, recall, marking accuracy and hover-label accuracy separately.
3. Fix detection/association failures; re-run blinded evaluations.
4. Do not claim >=99% until measured against the agreed dataset.

## Release gate 4 — End-to-end estimating and commercial readiness
1. Verify takeoff-to-estimate quantities, labor, pricing, exports, and revision changes.
2. Verify Buildr integration and multi-tenant boundaries.
3. Complete regression, security, performance, accessibility, and recovery testing.
4. Present test evidence and request approval before merge or deployment.

For each item record: source files, acceptance criteria, before/after behavior, tests run, evidence, remaining defects, and release decision. Keep changes small and reviewable; never rewrite working systems merely to satisfy the checklist.
