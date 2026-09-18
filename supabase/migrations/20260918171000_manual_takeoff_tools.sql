-- Manual takeoff tools foundation.
-- Supports fully manual and hybrid workflows alongside AI-assisted analysis.

create table if not exists public.takeoff_markups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.takeoff_projects(id) on delete cascade,
  sheet_id uuid not null references public.takeoff_sheets(id) on delete cascade,
  markup_type text not null check (markup_type in (
    'count','linear','polyline','area','rectangle','polygon','text','note','symbol',
    'circuit_trace','conduit_route','rack_route','home_run','dimension'
  )),
  category text,
  subtype text,
  label text,
  unit text,
  quantity numeric,
  geometry jsonb not null default '{}'::jsonb,
  style jsonb not null default '{}'::jsonb,
  properties jsonb not null default '{}'::jsonb,
  source text not null default 'manual' check (source in ('manual','ai','hybrid')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.takeoff_measurements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.takeoff_projects(id) on delete cascade,
  sheet_id uuid not null references public.takeoff_sheets(id) on delete cascade,
  markup_id uuid references public.takeoff_markups(id) on delete cascade,
  measurement_type text not null check (measurement_type in ('length','area','count','dimension')),
  raw_value numeric not null,
  normalized_value numeric not null,
  unit text not null,
  scale_source text not null default 'sheet' check (scale_source in ('sheet','manual_calibration','known_dimension')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.takeoff_tool_presets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  tool_type text not null,
  category text,
  subtype text,
  unit text,
  labor_item_key text,
  default_properties jsonb not null default '{}'::jsonb,
  default_style jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, name)
);

create table if not exists public.sheet_scale_calibrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sheet_id uuid not null references public.takeoff_sheets(id) on delete cascade,
  calibration_type text not null check (calibration_type in ('printed_scale','two_point','known_dimension')),
  point_a jsonb,
  point_b jsonb,
  known_length numeric,
  known_unit text,
  pixels_per_unit numeric,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists takeoff_markups_sheet_type_idx on public.takeoff_markups(sheet_id, markup_type);
create index if not exists takeoff_measurements_project_idx on public.takeoff_measurements(project_id, measurement_type);
create index if not exists tool_presets_org_idx on public.takeoff_tool_presets(org_id, tool_type);

alter table public.takeoff_markups enable row level security;
alter table public.takeoff_measurements enable row level security;
alter table public.takeoff_tool_presets enable row level security;
alter table public.sheet_scale_calibrations enable row level security;

do $$
declare t text;
begin
  foreach t in array array['takeoff_markups','takeoff_measurements','takeoff_tool_presets','sheet_scale_calibrations']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_org_access', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.current_is_platform_admin() or org_id = public.current_profile_org_id()) with check (public.current_is_platform_admin() or org_id = public.current_profile_org_id())',
      t || '_org_access', t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
