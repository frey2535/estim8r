-- Estim8r elite labor foundation.
-- Mirrors the organization/profile/RLS approach used by the Current Flow app stack.

create extension if not exists pgcrypto;

create table if not exists public.labor_items (
  id uuid primary key default gen_random_uuid(),
  trade text not null default 'Electrical',
  category text not null,
  subcategory text,
  item_name text not null,
  description text,
  material_type text,
  size text,
  unit text not null,
  quantity_per_labor_unit numeric not null default 1 check (quantity_per_labor_unit > 0),
  default_crew text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.labor_units (
  id uuid primary key default gen_random_uuid(),
  labor_item_id uuid not null references public.labor_items(id) on delete cascade,
  source_type text not null check (source_type in ('published_reference','estim8r_standard','manufacturer','government')),
  source_name text not null,
  source_year text,
  source_reference text,
  normal_mh numeric check (normal_mh >= 0),
  difficult_mh numeric check (difficult_mh >= 0),
  very_difficult_mh numeric check (very_difficult_mh >= 0),
  verification_status text not null default 'unverified' check (verification_status in ('unverified','researching','verified','needs_correction','deprecated')),
  production_allowed boolean not null default false,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not production_allowed or verification_status = 'verified')
);

create table if not exists public.company_labor_units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  labor_item_id uuid not null references public.labor_items(id) on delete cascade,
  normal_mh numeric check (normal_mh >= 0),
  difficult_mh numeric check (difficult_mh >= 0),
  very_difficult_mh numeric check (very_difficult_mh >= 0),
  source text not null default 'company_history',
  sample_size integer not null default 0 check (sample_size >= 0),
  confidence_level numeric not null default 0 check (confidence_level between 0 and 1),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, labor_item_id)
);

create table if not exists public.labor_production_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid,
  labor_item_id uuid not null references public.labor_items(id) on delete cascade,
  installed_quantity numeric not null check (installed_quantity > 0),
  unit text not null,
  actual_labor_hours numeric not null check (actual_labor_hours >= 0),
  crew_size numeric check (crew_size > 0),
  crew_type text,
  work_date date not null,
  factors jsonb not null default '[]'::jsonb,
  notes text,
  approved boolean not null default false,
  approved_by uuid references public.profiles(id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estimate_labor_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  estimate_id uuid not null,
  estimate_line_id uuid not null,
  labor_item_id uuid not null references public.labor_items(id) on delete restrict,
  selected_source text not null check (selected_source in ('published_reference','company_history','estim8r_standard','custom','manufacturer','government')),
  source_record_id uuid,
  condition text not null default 'normal' check (condition in ('normal','difficult','very_difficult')),
  base_mh_per_unit numeric not null check (base_mh_per_unit >= 0),
  factor_multiplier numeric not null default 1 check (factor_multiplier > 0),
  factors jsonb not null default '[]'::jsonb,
  calculated_mh_per_unit numeric not null check (calculated_mh_per_unit >= 0),
  estimator_override_mh_per_unit numeric check (estimator_override_mh_per_unit >= 0),
  effective_mh_per_unit numeric not null check (effective_mh_per_unit >= 0),
  override_reason text,
  source_name_snapshot text,
  source_year_snapshot text,
  source_reference_snapshot text,
  verification_status_snapshot text,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists labor_items_lookup_idx on public.labor_items(category, subcategory, item_name, size);
create index if not exists labor_units_item_idx on public.labor_units(labor_item_id);
create index if not exists labor_units_verification_idx on public.labor_units(verification_status, production_allowed);
create index if not exists company_labor_units_org_idx on public.company_labor_units(org_id, labor_item_id);
create index if not exists labor_production_history_org_item_idx on public.labor_production_history(org_id, labor_item_id);
create index if not exists estimate_labor_snapshots_estimate_idx on public.estimate_labor_snapshots(org_id, estimate_id);

alter table public.labor_items enable row level security;
alter table public.labor_units enable row level security;
alter table public.company_labor_units enable row level security;
alter table public.labor_production_history enable row level security;
alter table public.estimate_labor_snapshots enable row level security;

-- Master library is readable by authenticated users. Platform/admin roles manage it.
drop policy if exists "labor items read" on public.labor_items;
create policy "labor items read" on public.labor_items for select to authenticated using (true);

drop policy if exists "labor items manage" on public.labor_items;
create policy "labor items manage" on public.labor_items for all to authenticated
  using (public.current_can_manage_codebook())
  with check (public.current_can_manage_codebook());

drop policy if exists "labor units read" on public.labor_units;
create policy "labor units read" on public.labor_units for select to authenticated using (true);

drop policy if exists "labor units manage" on public.labor_units;
create policy "labor units manage" on public.labor_units for all to authenticated
  using (public.current_can_manage_codebook())
  with check (public.current_can_manage_codebook());

-- Company labor belongs only to the user's organization, except platform admins.
drop policy if exists "company labor own org read" on public.company_labor_units;
create policy "company labor own org read" on public.company_labor_units for select to authenticated
  using (public.current_is_platform_admin() or org_id = public.current_profile_org_id());

drop policy if exists "company labor own org write" on public.company_labor_units;
create policy "company labor own org write" on public.company_labor_units for all to authenticated
  using (public.current_is_platform_admin() or org_id = public.current_profile_org_id())
  with check (public.current_is_platform_admin() or org_id = public.current_profile_org_id());

drop policy if exists "production history own org read" on public.labor_production_history;
create policy "production history own org read" on public.labor_production_history for select to authenticated
  using (public.current_is_platform_admin() or org_id = public.current_profile_org_id());

drop policy if exists "production history own org write" on public.labor_production_history;
create policy "production history own org write" on public.labor_production_history for all to authenticated
  using (public.current_is_platform_admin() or org_id = public.current_profile_org_id())
  with check (public.current_is_platform_admin() or org_id = public.current_profile_org_id());

drop policy if exists "estimate labor snapshots own org read" on public.estimate_labor_snapshots;
create policy "estimate labor snapshots own org read" on public.estimate_labor_snapshots for select to authenticated
  using (public.current_is_platform_admin() or org_id = public.current_profile_org_id());

drop policy if exists "estimate labor snapshots own org insert" on public.estimate_labor_snapshots;
create policy "estimate labor snapshots own org insert" on public.estimate_labor_snapshots for insert to authenticated
  with check (public.current_is_platform_admin() or org_id = public.current_profile_org_id());

-- Estimate labor snapshots are intentionally immutable. Corrections create a new snapshot/version.

grant select on public.labor_items, public.labor_units to authenticated;
grant select, insert, update, delete on public.company_labor_units, public.labor_production_history to authenticated;
grant select, insert on public.estimate_labor_snapshots to authenticated;
