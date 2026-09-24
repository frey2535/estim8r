# Estim8r Estimating Intelligence Upgrade

This upgrade is intentionally company-agnostic. Do not add Day One Electric defaults, labor rates, productivity, branding, price books, or policies to the core product. Company-specific tuning belongs in tenant/company configuration after the generic application is complete.

## Implemented foundation

- Estimate completeness / bid-readiness model for material, labor, equipment, supervision, mobilization, demobilization, delivery, permits, bonds/insurance, temporary power, waste, sales tax, overhead, profit and contingency.
- Installed-cost calculation that keeps material, labor hours, labor dollars, equipment and installed cost separate.
- Reusable assembly expansion.
- Drawing-sheet quantity/cost rollups so takeoff quantities remain auditable to their source sheet.
- Existing source-aware labor architecture remains authoritative: verified published reference, company history, Estim8r experimental and custom labor stay distinct.
- Existing productivity factors remain explicit multipliers rather than hidden adjustments.

## Guardrails

1. Never silently promote generated/model labor to verified production labor.
2. Never copy proprietary published labor tables into the repository without confirmed data rights.
3. Preserve source name, edition/year, reference and verification state for reference labor.
4. Snapshot the labor basis used on a bid so historical estimates do not change when the master library changes.
5. Material pricing is time-sensitive and should retain source/date; do not treat static reference-book material pricing as live supplier pricing.
6. Keep all tenant-owned overrides isolated by company/org ID.
7. Keep takeoff quantities traceable to drawing sheet and, where available, marker/run IDs.

## Next UI/data integration

Wire the foundation into Estimate Builder as a Bid Readiness panel, add an Assembly Library/editor, persist assembly definitions and checklist state in Supabase, and connect sheet rollups to clickable drawing highlights. These should remain generic platform features.
