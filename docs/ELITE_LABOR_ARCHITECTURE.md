# Estim8r Elite Labor Architecture

## Purpose

This architecture separates the electrical trade taxonomy from labor-hour authority. Generated/model baselines may be retained for research and calibration, but they must never silently become production bid labor.

## Core rule

A published/reference labor unit is production-safe only when:

- `verificationStatus === "verified"`
- `productionAllowed === true`

Company-specific approved labor and explicit estimator overrides are separate sources and must retain their own audit trail.

## Domain layers

1. **Master Labor Library** — trade/category/subcategory/item/size/unit taxonomy.
2. **Reference Labor Units** — traceable source, edition/year, reference, labor conditions, verification.
3. **Company Labor Units** — company-isolated approved production rates.
4. **Production History** — installed quantity and actual labor hours from completed work.
5. **Productivity Factors** — transparent multipliers for project conditions.
6. **Estimate Labor Selection** — immutable snapshot of the labor basis used on a bid.
7. **Audit History** — who selected/changed/approved labor and why.

## Multi-company isolation

All company-owned records must include `company_id`. Authorization must be enforced server-side; client-side filtering is not sufficient. A company may override a master/reference labor value without modifying the master record.

## Recommended persistence model

### labor_items

- id
- trade
- category
- subcategory
- item_name
- description
- material_type
- size
- unit
- quantity_per_labor_unit
- default_crew
- active

### labor_units

- id
- labor_item_id
- source_type
- source_name
- source_year
- source_reference
- normal_mh
- difficult_mh
- very_difficult_mh
- verification_status
- production_allowed
- verified_by
- verified_date
- notes

### company_labor_units

- id
- company_id
- labor_item_id
- normal_mh
- difficult_mh
- very_difficult_mh
- source
- sample_size
- confidence_level
- approved_by
- approved_at
- active

### labor_production_history

- id
- company_id
- project_id
- labor_item_id
- installed_quantity
- unit
- actual_labor_hours
- crew_size
- crew_type
- work_date
- conditions/factors
- notes
- approved
- approved_by

### estimate_labor_snapshots

Persist the actual labor basis used on each estimate line. Never recalculate an old estimate from a mutable current master value.

- estimate_id
- estimate_line_id
- labor_item_id
- selected_source
- source_record_id
- condition
- base_mh_per_unit
- factor_multiplier
- calculated_mh_per_unit
- estimator_override_mh_per_unit
- effective_mh_per_unit
- override_reason
- source_name_snapshot
- source_year_snapshot
- source_reference_snapshot
- verification_status_snapshot
- created_by
- created_at

## Productivity factor model

Do not reduce all field conditions to Normal/Difficult/Very Difficult. Keep explicit factors for:

- height
- congestion
- occupied space
- material handling distance
- restricted access
- shift/overtime conditions
- weather
- repetitive work
- prefab
- lift/scaffold/equipment requirements
- underground conditions
- custom project-specific conditions

The UI must show the combined multiplier and every contributing factor.

## Production calibration

For a labor unit expressed per 100 LF:

`actual_mh_per_unit = actual_labor_hours / (installed_quantity / 100)`

Only approved production-history records should feed company averages. Display sample size, average, median, quartiles and confidence beside the company labor rate. Do not silently overwrite the estimator's selected labor.

## Required UI behavior

When selecting labor for an estimate line, show side-by-side:

- verified published/reference labor
- company historical labor with sample size/confidence
- Estim8r baseline with verification warning
- custom labor

Unverified model baselines require explicit acknowledgement/override and must be visually distinct.

## Next implementation phases

1. Recover/sync the complete Estim8r application source into GitHub.
2. Map this domain model onto the actual backend in use.
3. Add company isolation and server-side authorization/RLS equivalent.
4. Import the 1,921-item taxonomy without promoting unverified labor to production.
5. Add Master Labor Library + verification dashboard.
6. Add labor selector to estimate lines and immutable labor snapshots.
7. Add productivity-factor editor.
8. Add production-history calibration and estimate-vs-actual reporting.
9. Add assemblies, WBS/phasing, alternates, revisions/change orders and bid analytics.
10. Add vendor/material price-book integration and full estimate audit reporting.

## Current repository warning

As inspected on 2026-09-17, `main` contains the Base44 auth/UI skeleton and no Estim8r estimating routes/pages. Do not merge application-facing implementation into `main` until the complete working Estim8r source is confirmed or restored.
