-- Current Flow product entitlement foundation.
-- Authentication identifies the person/company; entitlements decide which paid apps they own.

create table if not exists public.product_entitlements (
  id uuid primary key default gen_random_uuid(),
  product_key text not null,
  profile_id uuid references public.profiles(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  status text not null default 'active' check (status in ('active','trial','expired','revoked')),
  access_type text not null default 'purchase' check (access_type in ('purchase','subscription','trial','bundle','owner_grant')),
  source text not null default 'manual',
  bundle_key text,
  seats integer,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (profile_id is not null or org_id is not null)
);

create index if not exists product_entitlements_profile_product_idx
  on public.product_entitlements(profile_id, product_key);
create index if not exists product_entitlements_org_product_idx
  on public.product_entitlements(org_id, product_key);

alter table public.product_entitlements enable row level security;

drop policy if exists "entitlements own read" on public.product_entitlements;
create policy "entitlements own read" on public.product_entitlements
for select to authenticated
using (
  public.current_is_platform_admin()
  or profile_id = auth.uid()
  or (org_id is not null and org_id = public.current_profile_org_id())
);

grant select on public.product_entitlements to authenticated;

create or replace function public.current_product_entitlement(requested_product text)
returns table(
  product_key text,
  status text,
  access_type text,
  source text,
  bundle_key text,
  seats integer,
  expires_at timestamptz,
  metadata jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select e.product_key, e.status, e.access_type, e.source, e.bundle_key, e.seats, e.expires_at, e.metadata
  from public.product_entitlements e
  where e.product_key = requested_product
    and (e.profile_id = auth.uid() or e.org_id = public.current_profile_org_id())
    and e.status in ('active','trial')
    and (e.expires_at is null or e.expires_at >= now())
  order by
    case when e.status = 'active' then 0 else 1 end,
    e.expires_at desc nulls first,
    e.created_at desc
  limit 1;
$$;

grant execute on function public.current_product_entitlement(text) to authenticated;
