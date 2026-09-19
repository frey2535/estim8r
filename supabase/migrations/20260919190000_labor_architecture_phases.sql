-- Phase 1–2 labor architecture.
-- Extends the existing elite labor foundation. Does not re-import the 1,921-row table
-- and does not insert published/NECA man-hours.

-- ---------------------------------------------------------------------------
-- Source types: experimental + custom
-- ---------------------------------------------------------------------------
alter table public.labor_units drop constraint if exists labor_units_source_type_check;
alter table public.labor_units
  add constraint labor_units_source_type_check
  check (source_type in (
    'published_reference',
    'estim8r_standard',
    'manufacturer',
    'government',
    'experimental',
    'custom',
    'company_history'
  ));

alter table public.estimate_labor_snapshots drop constraint if exists estimate_labor_snapshots_selected_source_check;
alter table public.estimate_labor_snapshots
  add constraint estimate_labor_snapshots_selected_source_check
  check (selected_source in (
    'published_reference',
    'company_history',
    'estim8r_standard',
    'custom',
    'manufacturer',
    'government',
    'experimental'
  ));

-- Migrate every imported labor unit to experimental / unverified.
-- Keep existing man-hours. Clear published/NECA labels and references.
-- Do not invent hours and do not populate NECA values.
update public.labor_units
set
  source_type = 'experimental',
  source_name = 'Estim8r imported labor (experimental)',
  source_reference = '',
  verification_status = 'unverified',
  production_allowed = false,
  notes = 'Experimental / unverified imported labor. Not a production bid rate.',
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Company custom labor (estimator-entered hours only)
-- ---------------------------------------------------------------------------
create table if not exists public.custom_labor_units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  labor_item_id uuid references public.labor_items(id) on delete set null,
  item_name text not null,
  category text,
  subcategory text,
  size text,
  unit text not null default 'EA',
  normal_mh numeric check (normal_mh is null or normal_mh >= 0),
  difficult_mh numeric check (difficult_mh is null or difficult_mh >= 0),
  very_difficult_mh numeric check (very_difficult_mh is null or very_difficult_mh >= 0),
  notes text,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_labor_units_org_idx
  on public.custom_labor_units(org_id, labor_item_id);

-- ---------------------------------------------------------------------------
-- Labor rates (company wage book)
-- ---------------------------------------------------------------------------
create table if not exists public.labor_rates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  class_id text not null,
  label text not null,
  hourly_rate numeric not null check (hourly_rate >= 0),
  updated_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, class_id)
);

create index if not exists labor_rates_org_idx on public.labor_rates(org_id);

-- ---------------------------------------------------------------------------
-- Named crews
-- ---------------------------------------------------------------------------
create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  notes text,
  active boolean not null default true,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crew_members (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  class_id text not null,
  label text not null,
  hourly_rate numeric not null check (hourly_rate >= 0),
  headcount numeric not null default 1 check (headcount >= 0)
);

create index if not exists crews_org_idx on public.crews(org_id, active);
create index if not exists crew_members_crew_idx on public.crew_members(crew_id);

-- ---------------------------------------------------------------------------
-- Productivity factor catalog (multipliers only; default 1.00 — no invented hours)
-- ---------------------------------------------------------------------------
create table if not exists public.productivity_factor_definitions (
  code text primary key,
  label text not null,
  category text not null,
  default_multiplier numeric not null default 1 check (default_multiplier > 0),
  description text
);

insert into public.productivity_factor_definitions (code, label, category, default_multiplier, description)
values
  ('height', 'Height', 'height', 1, 'Working height / elevation. Estimator sets the multiplier.'),
  ('congestion', 'Congestion', 'congestion', 1, 'Congested work area.'),
  ('occupied_space', 'Occupied space', 'occupied_space', 1, 'Occupied or operational building.'),
  ('material_handling', 'Material handling distance', 'material_handling', 1, 'Distance from staging to install.'),
  ('access', 'Restricted access', 'access', 1, 'Restricted or limited access.'),
  ('shift', 'Shift / overtime', 'shift', 1, 'Shift work or overtime conditions.'),
  ('weather', 'Weather', 'weather', 1, 'Weather exposure.'),
  ('repetition', 'Repetitive work', 'repetition', 1, 'Repetition / learning-curve adjustment.'),
  ('prefab', 'Prefab', 'prefab', 1, 'Prefabrication credit or penalty.'),
  ('equipment', 'Lift / scaffold / equipment', 'equipment', 1, 'Lift, scaffold, or special equipment.'),
  ('underground', 'Underground', 'underground', 1, 'Underground or buried conditions.'),
  ('custom', 'Custom project condition', 'custom', 1, 'Estimator-defined project condition.')
on conflict (code) do nothing;

create table if not exists public.company_productivity_factors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  label text not null,
  category text not null,
  multiplier numeric not null check (multiplier > 0),
  notes text,
  unique (org_id, code)
);

create index if not exists company_productivity_factors_org_idx
  on public.company_productivity_factors(org_id);

-- Optional snapshot fields for crew/rate used on a bid line.
alter table public.estimate_labor_snapshots
  add column if not exists crew_id uuid,
  add column if not exists labor_rate_snapshot numeric,
  add column if not exists acknowledged_unverified boolean not null default false;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.custom_labor_units enable row level security;
alter table public.labor_rates enable row level security;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.productivity_factor_definitions enable row level security;
alter table public.company_productivity_factors enable row level security;

drop policy if exists "custom labor own org" on public.custom_labor_units;
create policy "custom labor own org" on public.custom_labor_units for all to authenticated
  using (public.current_is_platform_admin() or org_id = public.current_profile_org_id())
  with check (public.current_is_platform_admin() or org_id = public.current_profile_org_id());

drop policy if exists "labor rates own org" on public.labor_rates;
create policy "labor rates own org" on public.labor_rates for all to authenticated
  using (public.current_is_platform_admin() or org_id = public.current_profile_org_id())
  with check (public.current_is_platform_admin() or org_id = public.current_profile_org_id());

drop policy if exists "crews own org" on public.crews;
create policy "crews own org" on public.crews for all to authenticated
  using (public.current_is_platform_admin() or org_id = public.current_profile_org_id())
  with check (public.current_is_platform_admin() or org_id = public.current_profile_org_id());

drop policy if exists "crew members via crew org" on public.crew_members;
create policy "crew members via crew org" on public.crew_members for all to authenticated
  using (
    public.current_is_platform_admin()
    or exists (
      select 1 from public.crews c
      where c.id = crew_id
        and c.org_id = public.current_profile_org_id()
    )
  )
  with check (
    public.current_is_platform_admin()
    or exists (
      select 1 from public.crews c
      where c.id = crew_id
        and c.org_id = public.current_profile_org_id()
    )
  );

drop policy if exists "productivity factor definitions read" on public.productivity_factor_definitions;
create policy "productivity factor definitions read" on public.productivity_factor_definitions
  for select to authenticated using (true);

drop policy if exists "productivity factor definitions manage" on public.productivity_factor_definitions;
create policy "productivity factor definitions manage" on public.productivity_factor_definitions
  for all to authenticated
  using (public.current_can_manage_codebook())
  with check (public.current_can_manage_codebook());

drop policy if exists "company productivity factors own org" on public.company_productivity_factors;
create policy "company productivity factors own org" on public.company_productivity_factors
  for all to authenticated
  using (public.current_is_platform_admin() or org_id = public.current_profile_org_id())
  with check (public.current_is_platform_admin() or org_id = public.current_profile_org_id());

grant select on public.productivity_factor_definitions to authenticated;
grant select, insert, update, delete on
  public.custom_labor_units,
  public.labor_rates,
  public.crews,
  public.crew_members,
  public.company_productivity_factors
  to authenticated;
