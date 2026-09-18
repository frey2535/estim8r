-- Elite takeoff / drawing intelligence foundation for Estim8r.
-- Establishes tenant-safe storage for drawing sheets, detections, circuits, routing,
-- conduit grouping, counts, and analysis jobs. AI/CV workers consume and populate
-- these records; the browser does not receive privileged cross-tenant access.

create table if not exists public.takeoff_projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  project_number text,
  address text,
  status text not null default 'draft' check (status in ('draft','analyzing','review','approved','archived')),
  drawing_set_name text,
  drawing_revision text,
  nec_year integer,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.takeoff_sheets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.takeoff_projects(id) on delete cascade,
  sheet_number text,
  title text,
  discipline text,
  page_index integer not null,
  source_file_name text,
  source_storage_path text,
  width_points numeric,
  height_points numeric,
  scale_text text,
  scale_ratio numeric,
  rotation integer not null default 0,
  analysis_status text not null default 'pending' check (analysis_status in ('pending','processing','review','complete','failed')),
  notes_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.symbol_catalog (
  id uuid primary key default gen_random_uuid(),
  symbol_key text not null unique,
  category text not null,
  subtype text,
  display_name text not null,
  synonyms text[] not null default '{}',
  description text,
  expected_context text,
  default_takeoff_unit text not null default 'EA',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sheet_detections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.takeoff_projects(id) on delete cascade,
  sheet_id uuid not null references public.takeoff_sheets(id) on delete cascade,
  symbol_id uuid references public.symbol_catalog(id) on delete set null,
  detected_label text,
  category text not null,
  subtype text,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  x numeric not null,
  y numeric not null,
  width numeric not null,
  height numeric not null,
  rotation numeric not null default 0,
  source text not null default 'ai' check (source in ('ai','manual','imported')),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','accepted','corrected','rejected')),
  circuit_text text,
  panel_text text,
  equipment_tag text,
  note_context text,
  properties jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.electrical_circuits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.takeoff_projects(id) on delete cascade,
  circuit_number text not null,
  panel_name text,
  voltage numeric,
  poles integer,
  breaker_amps numeric,
  phase text,
  conductor_spec jsonb not null default '{}'::jsonb,
  load_description text,
  source_detection_id uuid references public.sheet_detections(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, panel_name, circuit_number)
);

create table if not exists public.circuit_devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  circuit_id uuid not null references public.electrical_circuits(id) on delete cascade,
  detection_id uuid not null references public.sheet_detections(id) on delete cascade,
  sequence_index integer,
  role text not null default 'load' check (role in ('source','load','junction','equipment')),
  created_at timestamptz not null default now(),
  unique(circuit_id, detection_id)
);

create table if not exists public.conduit_routes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.takeoff_projects(id) on delete cascade,
  sheet_id uuid references public.takeoff_sheets(id) on delete set null,
  route_name text not null,
  conduit_type text,
  trade_size text,
  route_kind text not null default 'branch' check (route_kind in ('branch','home_run','rack','feeder')),
  source_detection_id uuid references public.sheet_detections(id) on delete set null,
  destination_detection_id uuid references public.sheet_detections(id) on delete set null,
  geometry jsonb not null default '[]'::jsonb,
  measured_length_ft numeric not null default 0,
  vertical_allowance_ft numeric not null default 0,
  fitting_allowance_ft numeric not null default 0,
  total_length_ft numeric generated always as (measured_length_ft + vertical_allowance_ft + fitting_allowance_ft) stored,
  bend_count integer not null default 0,
  total_bend_degrees numeric not null default 0,
  requires_pull_point boolean not null default false,
  route_status text not null default 'proposed' check (route_status in ('proposed','review','approved','rejected')),
  routing_basis text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conduit_route_circuits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  route_id uuid not null references public.conduit_routes(id) on delete cascade,
  circuit_id uuid not null references public.electrical_circuits(id) on delete cascade,
  home_run_group integer,
  created_at timestamptz not null default now(),
  unique(route_id, circuit_id)
);

create table if not exists public.route_pull_points (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  route_id uuid not null references public.conduit_routes(id) on delete cascade,
  sheet_id uuid references public.takeoff_sheets(id) on delete set null,
  point_type text not null check (point_type in ('junction_box','pull_box','condulet')),
  x numeric,
  y numeric,
  reason text,
  cumulative_bend_degrees numeric,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.takeoff_quantities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.takeoff_projects(id) on delete cascade,
  sheet_id uuid references public.takeoff_sheets(id) on delete cascade,
  category text not null,
  subtype text,
  item_key text,
  description text not null,
  unit text not null,
  quantity numeric not null default 0,
  source text not null default 'derived' check (source in ('detected','derived','manual')),
  related_detection_ids uuid[] not null default '{}',
  related_route_ids uuid[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.takeoff_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.takeoff_projects(id) on delete cascade,
  sheet_id uuid references public.takeoff_sheets(id) on delete cascade,
  job_type text not null check (job_type in ('sheet_parse','notes_context','symbol_detection','circuit_trace','route_plan','quantity_rollup','marked_sheet_export')),
  status text not null default 'queued' check (status in ('queued','running','complete','failed','cancelled')),
  model_name text,
  model_version text,
  confidence_summary jsonb not null default '{}'::jsonb,
  input_metadata jsonb not null default '{}'::jsonb,
  output_metadata jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists takeoff_sheets_project_idx on public.takeoff_sheets(project_id, page_index);
create index if not exists sheet_detections_project_category_idx on public.sheet_detections(project_id, category);
create index if not exists circuit_devices_circuit_idx on public.circuit_devices(circuit_id, sequence_index);
create index if not exists conduit_routes_project_kind_idx on public.conduit_routes(project_id, route_kind);
create index if not exists route_circuits_route_idx on public.conduit_route_circuits(route_id);
create index if not exists quantities_project_category_idx on public.takeoff_quantities(project_id, category);
create index if not exists analysis_jobs_project_status_idx on public.takeoff_analysis_jobs(project_id, status);

alter table public.takeoff_projects enable row level security;
alter table public.takeoff_sheets enable row level security;
alter table public.sheet_detections enable row level security;
alter table public.electrical_circuits enable row level security;
alter table public.circuit_devices enable row level security;
alter table public.conduit_routes enable row level security;
alter table public.conduit_route_circuits enable row level security;
alter table public.route_pull_points enable row level security;
alter table public.takeoff_quantities enable row level security;
alter table public.takeoff_analysis_jobs enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'takeoff_projects','takeoff_sheets','sheet_detections','electrical_circuits',
    'circuit_devices','conduit_routes','conduit_route_circuits','route_pull_points',
    'takeoff_quantities','takeoff_analysis_jobs'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_org_access', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.current_is_platform_admin() or org_id = public.current_profile_org_id()) with check (public.current_is_platform_admin() or org_id = public.current_profile_org_id())',
      t || '_org_access', t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Symbol catalog is globally readable but only platform/admin maintained.
alter table public.symbol_catalog enable row level security;
drop policy if exists symbol_catalog_read on public.symbol_catalog;
create policy symbol_catalog_read on public.symbol_catalog for select to authenticated using (active);
drop policy if exists symbol_catalog_manage on public.symbol_catalog;
create policy symbol_catalog_manage on public.symbol_catalog for all to authenticated
using (public.current_can_manage_codebook())
with check (public.current_can_manage_codebook());
grant select on public.symbol_catalog to authenticated;
grant insert, update, delete on public.symbol_catalog to authenticated;

insert into public.symbol_catalog(symbol_key,category,subtype,display_name,synonyms,expected_context,default_takeoff_unit)
values
('receptacle_duplex','receptacles','duplex','Duplex Receptacle',array['duplex','receptacle','outlet'],'Branch circuit device; wall/floor plans','EA'),
('lighting_fixture','lighting','fixture','Lighting Fixture',array['light','fixture','luminaire'],'Lighting plan, reflected ceiling plan, schedules','EA'),
('hvac_equipment','hvac','equipment','HVAC Equipment',array['ahu','rtu','cu','fcU','hvac'],'Mechanical/electrical plans and equipment schedules','EA'),
('panelboard','distribution','panelboard','Panelboard',array['panel','panelboard','LP','PP'],'Power plans, risers, panel schedules','EA'),
('motor_control_center','distribution','mcc','Motor Control Center',array['MCC','motor control center'],'Industrial power plans and one-lines','EA'),
('junction_box','raceway','junction_box','Junction Box',array['JB','J-box','junction box'],'Raceway routing and pull point','EA'),
('condulet','raceway','condulet','Condulet',array['LB','LL','LR','C body'],'Raceway routing change/pull point','EA')
on conflict (symbol_key) do nothing;
