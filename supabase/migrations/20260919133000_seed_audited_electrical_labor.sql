-- Production-ready rows from Estim8r_Source_Audited_Electrical_Labor_Database.xlsx
-- (Production Import). Unverified model-baseline rows are intentionally not seeded.

insert into public.labor_items (
  id, trade, category, subcategory, item_name, description, material_type, size, unit, quantity_per_labor_unit, active
) values
  ('00000000-0000-4000-a000-000000000050', 'Electrical', 'Raceways', 'Conduit Installation', 'Install EMT',
    'NECA sample lists 5.00/6.20/7.50 per C; normalized here to MH per LF for Estim8r.',
    'EMT', '3/4 in', 'LF', 1, true),
  ('00000000-0000-4000-a000-000000000051', 'Electrical', 'Raceways', 'Fittings', 'Install EMT Connector',
    'Official NECA public sample: EMT set-screw box connector, each.',
    'EMT', '3/4 in', 'EA', 1, true),
  ('00000000-0000-4000-a000-000000000052', 'Electrical', 'Raceways', 'Fittings', 'Install EMT Coupling',
    'Official NECA public sample: EMT set-screw coupling, each.',
    'EMT', '3/4 in', 'EA', 1, true),
  ('00000000-0000-4000-a000-000000000053', 'Electrical', 'Raceways', 'Fittings', 'Install EMT Factory elbow',
    'Official NECA public sample: EMT factory elbow, each.',
    'EMT', '3/4 in', 'EA', 1, true),
  ('00000000-0000-4000-a000-000000000061', 'Electrical', 'Raceways', 'Conduit Installation', 'Install EMT',
    'NECA sample lists 5.50/6.80/8.20 per C; normalized here to MH per LF for Estim8r.',
    'EMT', '1 in', 'LF', 1, true)
on conflict (id) do nothing;

insert into public.labor_units (
  id, labor_item_id, source_type, source_name, source_year, source_reference,
  normal_mh, difficult_mh, very_difficult_mh, verification_status, production_allowed, notes
) values
  ('00000000-0000-4000-a000-000000100050', '00000000-0000-4000-a000-000000000050',
    'published_reference', 'NECA MLU public sample', '2021-2022',
    'https://www.necanet.org/docs/default-source/education/publications/4090-21_2021-2022mlu_page202revised.pdf?sfvrsn=52e712c0_3',
    0.05, 0.062, 0.075, 'verified', true,
    'NECA sample lists 5.00/6.20/7.50 per C; normalized here to MH per LF for Estim8r.'),
  ('00000000-0000-4000-a000-000000100051', '00000000-0000-4000-a000-000000000051',
    'published_reference', 'NECA MLU public sample', '2021-2022',
    'https://www.necanet.org/docs/default-source/education/publications/4090-21_2021-2022mlu_page202revised.pdf?sfvrsn=52e712c0_3',
    0.1, 0.12, 0.15, 'verified', true,
    'Official NECA public sample: EMT set-screw box connector, each.'),
  ('00000000-0000-4000-a000-000000100052', '00000000-0000-4000-a000-000000000052',
    'published_reference', 'NECA MLU public sample', '2021-2022',
    'https://www.necanet.org/docs/default-source/education/publications/4090-21_2021-2022mlu_page202revised.pdf?sfvrsn=52e712c0_3',
    0.05, 0.06, 0.07, 'verified', true,
    'Official NECA public sample: EMT set-screw coupling, each.'),
  ('00000000-0000-4000-a000-000000100053', '00000000-0000-4000-a000-000000000053',
    'published_reference', 'NECA MLU public sample', '2021-2022',
    'https://www.necanet.org/docs/default-source/education/publications/4090-21_2021-2022mlu_page202revised.pdf?sfvrsn=52e712c0_3',
    0.22, 0.27, 0.33, 'verified', true,
    'Official NECA public sample: EMT factory elbow, each.'),
  ('00000000-0000-4000-a000-000000100061', '00000000-0000-4000-a000-000000000061',
    'published_reference', 'NECA MLU public sample', '2021-2022',
    'https://www.necanet.org/docs/default-source/education/publications/4090-21_2021-2022mlu_page202revised.pdf?sfvrsn=52e712c0_3',
    0.055, 0.068, 0.082, 'verified', true,
    'NECA sample lists 5.50/6.80/8.20 per C; normalized here to MH per LF for Estim8r.')
on conflict (id) do nothing;
