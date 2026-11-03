-- Canonical per-organization estimate snapshots. Existing local drafts are never deleted by this migration.
create table if not exists public.estim8r_estimate_snapshots (
  id uuid primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint estim8r_snapshot_payload_object check (jsonb_typeof(payload) = 'object')
);
create index if not exists estim8r_snapshots_org_updated on public.estim8r_estimate_snapshots(org_id, updated_at desc);
alter table public.estim8r_estimate_snapshots enable row level security;
drop policy if exists estim8r_snapshots_select on public.estim8r_estimate_snapshots;
create policy estim8r_snapshots_select on public.estim8r_estimate_snapshots for select to authenticated
  using (org_id = public.current_profile_org_id());
drop policy if exists estim8r_snapshots_insert on public.estim8r_estimate_snapshots;
create policy estim8r_snapshots_insert on public.estim8r_estimate_snapshots for insert to authenticated
  with check (org_id = public.current_profile_org_id() and owner_id = auth.uid());
drop policy if exists estim8r_snapshots_update on public.estim8r_estimate_snapshots;
create policy estim8r_snapshots_update on public.estim8r_estimate_snapshots for update to authenticated
  using (org_id = public.current_profile_org_id())
  with check (org_id = public.current_profile_org_id());
grant select, insert, update on public.estim8r_estimate_snapshots to authenticated;
-- Optimistic locking: reject stale revisions instead of silently overwriting another device.
create or replace function public.estim8r_save_snapshot(p_id uuid, p_payload jsonb, p_expected_revision bigint default null)
returns public.estim8r_estimate_snapshots
language plpgsql security invoker set search_path = public as $$
declare v_org uuid; v_row public.estim8r_estimate_snapshots;
begin
  v_org := public.current_profile_org_id();
  if auth.uid() is null or v_org is null then raise exception 'Authentication and organization required'; end if;
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'Invalid estimate payload'; end if;
  insert into public.estim8r_estimate_snapshots(id, org_id, owner_id, payload)
  select p_id, v_org, auth.uid(), p_payload
  where p_expected_revision is null
  on conflict do nothing
  returning * into v_row;
  if found then return v_row; end if;
  update public.estim8r_estimate_snapshots
    set payload = p_payload, revision = revision + 1, updated_at = now()
    where id = p_id and org_id = v_org and revision = p_expected_revision
    returning * into v_row;
  if not found then raise exception 'Estimate changed on another device. Reload before saving.' using errcode = '40001'; end if;
  return v_row;
end $$;
grant execute on function public.estim8r_save_snapshot(uuid,jsonb,bigint) to authenticated;
