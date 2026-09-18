-- Takeoff quality and bid-safety gates.
-- A missing detection is never treated as proof that no item exists.

create table if not exists public.takeoff_review_regions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.takeoff_projects(id) on delete cascade,
  sheet_id uuid not null references public.takeoff_sheets(id) on delete cascade,
  region_kind text not null check (region_kind in ('unresolved_symbol','low_confidence','unreadable_text','legend_gap','note_conflict','count_discrepancy','unscanned_region','manual_review')),
  geometry jsonb not null default '{}'::jsonb,
  severity text not null default 'blocking' check (severity in ('info','warning','blocking')),
  description text not null,
  status text not null default 'open' check (status in ('open','resolved','accepted_risk')),
  detection_ids uuid[] not null default '{}',
  resolution_note text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.takeoff_sheet_verification (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.takeoff_projects(id) on delete cascade,
  sheet_id uuid not null references public.takeoff_sheets(id) on delete cascade,
  image_readability numeric not null default 0 check (image_readability between 0 and 1),
  text_readability numeric not null default 0 check (text_readability between 0 and 1),
  legend_coverage numeric not null default 0 check (legend_coverage between 0 and 1),
  symbol_scan_coverage numeric not null default 0 check (symbol_scan_coverage between 0 and 1),
  notes_reviewed boolean not null default false,
  legend_reviewed boolean not null default false,
  schedules_reviewed boolean not null default false,
  one_lines_reviewed boolean not null default false,
  full_sheet_scanned boolean not null default false,
  blocking_issue_count integer not null default 0,
  warning_issue_count integer not null default 0,
  detected_count integer not null default 0,
  reviewed_count integer not null default 0,
  rejected_count integer not null default 0,
  manual_add_count integer not null default 0,
  verification_status text not null default 'not_started' check (verification_status in ('not_started','in_progress','blocked','verified')),
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sheet_id)
);

create table if not exists public.takeoff_count_reconciliations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.takeoff_projects(id) on delete cascade,
  sheet_id uuid references public.takeoff_sheets(id) on delete cascade,
  category text not null,
  subtype text,
  ai_count integer not null default 0,
  accepted_detection_count integer not null default 0,
  manual_count integer not null default 0,
  schedule_count integer,
  legend_expected boolean,
  discrepancy integer not null default 0,
  status text not null default 'unreconciled' check (status in ('unreconciled','matched','review_required','resolved')),
  resolution_note text,
  updated_at timestamptz not null default now()
);

alter table public.sheet_detections
  add column if not exists detector_passes jsonb not null default '[]'::jsonb,
  add column if not exists context_confidence numeric not null default 0 check (context_confidence between 0 and 1),
  add column if not exists geometry_confidence numeric not null default 0 check (geometry_confidence between 0 and 1),
  add column if not exists legend_match_confidence numeric not null default 0 check (legend_match_confidence between 0 and 1),
  add column if not exists requires_review boolean not null default true,
  add column if not exists review_reason text;

alter table public.takeoff_projects
  add column if not exists bid_readiness text not null default 'blocked' check (bid_readiness in ('blocked','review_required','verified')),
  add column if not exists verification_summary jsonb not null default '{}'::jsonb;

create index if not exists takeoff_review_regions_sheet_status_idx on public.takeoff_review_regions(sheet_id,status,severity);
create index if not exists takeoff_sheet_verification_project_idx on public.takeoff_sheet_verification(project_id,verification_status);
create index if not exists takeoff_reconciliation_project_idx on public.takeoff_count_reconciliations(project_id,status);

alter table public.takeoff_review_regions enable row level security;
alter table public.takeoff_sheet_verification enable row level security;
alter table public.takeoff_count_reconciliations enable row level security;

do $$
declare t text;
begin
  foreach t in array array['takeoff_review_regions','takeoff_sheet_verification','takeoff_count_reconciliations']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_org_access', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.current_is_platform_admin() or org_id = public.current_profile_org_id()) with check (public.current_is_platform_admin() or org_id = public.current_profile_org_id())',
      t || '_org_access', t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

create or replace function public.takeoff_project_can_be_verified(requested_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.takeoff_sheets s
      where s.project_id = requested_project
    )
    and not exists (
      select 1 from public.takeoff_sheets s
      left join public.takeoff_sheet_verification v on v.sheet_id = s.id
      where s.project_id = requested_project
        and (
          v.id is null
          or v.verification_status <> 'verified'
          or not v.full_sheet_scanned
          or v.blocking_issue_count > 0
        )
    )
    and not exists (
      select 1 from public.takeoff_review_regions r
      where r.project_id = requested_project
        and r.status = 'open'
        and r.severity = 'blocking'
    )
    and not exists (
      select 1 from public.takeoff_count_reconciliations c
      where c.project_id = requested_project
        and c.status in ('unreconciled','review_required')
    );
$$;

grant execute on function public.takeoff_project_can_be_verified(uuid) to authenticated;
