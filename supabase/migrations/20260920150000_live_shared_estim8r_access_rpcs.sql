-- Live-safe Estim8r grant/revoke RPCs for the shared Current Flow Supabase project.
-- #46 never reached that database. Its SQL also cannot be applied there:
--   * profiles uses created_date/updated_date, not created_at/updated_at
--   * CHECK constraints reject access_type=owner_grant, access_status=revoked,
--     and purchase_source=platform_owner
--   * product_entitlements may be missing
--   * replacing handle_new_user would overwrite the NECalcul8r signup trigger
-- This migration is idempotent and works on both that live schema and Estim8r-local.
-- Do not `supabase db push` the full Estim8r history onto the shared live project.

create or replace function public.current_is_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      p.is_platform_admin
      or lower(p.email) in (
        'currentflowconsultingllc@gmail.com',
        'marcus.a.frey@gmail.com'
      )
    from public.profiles p
    where p.id = auth.uid()
  ), false);
$$;

grant execute on function public.current_is_platform_staff() to authenticated;

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
  or public.current_is_platform_staff()
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

create table if not exists public.product_access_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  product_key text not null default 'estim8r',
  status text not null default 'pending' check (status in ('pending','consumed','revoked')),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_access_invites_pending_email_key
  on public.product_access_invites (lower(email), product_key)
  where status = 'pending';

alter table public.product_access_invites enable row level security;

drop policy if exists "invites staff read" on public.product_access_invites;
create policy "invites staff read" on public.product_access_invites
for select to authenticated
using (public.current_is_platform_staff());

grant select on public.product_access_invites to authenticated;

create or replace function public.list_estim8r_access()
returns table(
  profile_id uuid,
  email text,
  full_name text,
  access_status text,
  entitlement_status text,
  access_type text,
  source text,
  expires_at timestamptz,
  is_platform_owner boolean,
  is_backup_admin boolean,
  row_kind text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.current_is_platform_staff() then
    raise exception 'Only the platform owner or backup admin can manage Estim8r access.';
  end if;

  return query
  select
    p.id,
    p.email,
    p.full_name,
    p.access_status,
    e.status,
    e.access_type,
    e.source,
    e.expires_at,
    lower(p.email) = 'currentflowconsultingllc@gmail.com',
    lower(p.email) = 'marcus.a.frey@gmail.com',
    'user'::text
  from public.profiles p
  left join lateral (
    select ent.status, ent.access_type, ent.source, ent.expires_at
    from public.product_entitlements ent
    where ent.profile_id = p.id
      and ent.product_key = 'estim8r'
    order by
      case when ent.status in ('active','trial') then 0 else 1 end,
      ent.updated_at desc,
      ent.created_at desc
    limit 1
  ) e on true
  union all
  select
    null::uuid,
    lower(i.email),
    null::text,
    'invited'::text,
    i.status,
    'owner_grant'::text,
    'platform_owner'::text,
    null::timestamptz,
    false,
    false,
    'invite'::text
  from public.product_access_invites i
  where i.product_key = 'estim8r'
    and i.status = 'pending'
    and not exists (
      select 1 from public.profiles p2 where lower(p2.email) = lower(i.email)
    )
  order by 9 desc, 10 desc, 2;
end;
$$;

grant execute on function public.list_estim8r_access() to authenticated;

create or replace function public.grant_estim8r_access(target_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_profile public.profiles%rowtype;
  v_entitlement_id uuid;
  v_has_updated_date boolean;
begin
  if not public.current_is_platform_staff() then
    raise exception 'Only the platform owner or backup admin can manage Estim8r access.';
  end if;

  v_email := lower(trim(coalesce(target_email, '')));
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email is required.';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'updated_date'
  ) into v_has_updated_date;

  select * into v_profile
  from public.profiles
  where lower(email) = v_email
  limit 1;

  if v_profile.id is not null then
    select id into v_entitlement_id
    from public.product_entitlements
    where product_key = 'estim8r' and profile_id = v_profile.id
    order by updated_at desc
    limit 1;

    if v_entitlement_id is not null then
      update public.product_entitlements
      set
        status = 'active',
        access_type = 'owner_grant',
        source = 'platform_owner',
        starts_at = now(),
        expires_at = null,
        updated_at = now()
      where id = v_entitlement_id;
    else
      insert into public.product_entitlements (
        product_key, profile_id, status, access_type, source, starts_at, expires_at
      ) values (
        'estim8r', v_profile.id, 'active', 'owner_grant', 'platform_owner', now(), null
      );
    end if;

    if v_has_updated_date then
      update public.profiles
      set
        access_status = 'active',
        access_type = 'permanent',
        purchase_source = 'admin',
        updated_date = now()
      where id = v_profile.id;
    else
      update public.profiles
      set
        access_status = 'active',
        access_type = 'owner_grant',
        updated_at = now()
      where id = v_profile.id;
    end if;

    update public.product_access_invites
    set status = 'consumed', updated_at = now()
    where product_key = 'estim8r' and status = 'pending' and lower(email) = v_email;

    return jsonb_build_object('ok', true, 'email', v_email, 'action', 'granted');
  end if;

  insert into public.product_access_invites (email, product_key, status, invited_by)
  select v_email, 'estim8r', 'pending', auth.uid()
  where not exists (
    select 1 from public.product_access_invites
    where product_key = 'estim8r' and status = 'pending' and lower(email) = v_email
  );

  return jsonb_build_object('ok', true, 'email', v_email, 'action', 'invited');
end;
$$;

grant execute on function public.grant_estim8r_access(text) to authenticated;

create or replace function public.revoke_estim8r_access(target_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_has_updated_date boolean;
begin
  if not public.current_is_platform_staff() then
    raise exception 'Only the platform owner or backup admin can manage Estim8r access.';
  end if;

  v_email := lower(trim(coalesce(target_email, '')));
  if v_email = '' then
    raise exception 'A valid email is required.';
  end if;
  if v_email in ('currentflowconsultingllc@gmail.com', 'marcus.a.frey@gmail.com') then
    raise exception 'Cannot revoke platform owner or backup admin access.';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'updated_date'
  ) into v_has_updated_date;

  update public.product_entitlements e
  set status = 'revoked', updated_at = now()
  from public.profiles p
  where e.profile_id = p.id
    and e.product_key = 'estim8r'
    and lower(p.email) = v_email
    and e.status in ('active','trial');

  if v_has_updated_date then
    update public.profiles
    set access_status = 'disabled', updated_date = now()
    where lower(email) = v_email
      and lower(email) not in ('currentflowconsultingllc@gmail.com', 'marcus.a.frey@gmail.com');
  else
    update public.profiles
    set access_status = 'revoked', updated_at = now()
    where lower(email) = v_email
      and lower(email) not in ('currentflowconsultingllc@gmail.com', 'marcus.a.frey@gmail.com');
  end if;

  update public.product_access_invites
  set status = 'revoked', updated_at = now()
  where product_key = 'estim8r' and status = 'pending' and lower(email) = v_email;

  return jsonb_build_object('ok', true, 'email', v_email, 'action', 'revoked');
end;
$$;

grant execute on function public.revoke_estim8r_access(text) to authenticated;

create or replace function public.apply_estim8r_access_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_updated_date boolean;
begin
  if exists (
    select 1
    from public.product_access_invites i
    where i.product_key = 'estim8r'
      and i.status = 'pending'
      and lower(i.email) = lower(coalesce(new.email, ''))
  ) then
    insert into public.product_entitlements (
      product_key, profile_id, status, access_type, source, starts_at, expires_at
    )
    select
      'estim8r', new.id, 'active', 'owner_grant', 'platform_owner', now(), null
    where not exists (
      select 1 from public.product_entitlements e
      where e.profile_id = new.id and e.product_key = 'estim8r' and e.status in ('active','trial')
    );

    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'updated_date'
    ) into v_has_updated_date;

    if v_has_updated_date then
      update public.profiles
      set
        access_status = 'active',
        access_type = 'permanent',
        purchase_source = 'admin',
        updated_date = now()
      where id = new.id;
    else
      update public.profiles
      set
        access_status = 'active',
        access_type = 'owner_grant',
        updated_at = now()
      where id = new.id;
    end if;

    update public.product_access_invites
    set status = 'consumed', updated_at = now()
    where product_key = 'estim8r'
      and status = 'pending'
      and lower(email) = lower(coalesce(new.email, ''));
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_estim8r_invite on public.profiles;
create trigger on_profile_estim8r_invite
after insert on public.profiles
for each row execute function public.apply_estim8r_access_invite();

update public.profiles
set is_platform_admin = true
where lower(email) in (
  'currentflowconsultingllc@gmail.com',
  'marcus.a.frey@gmail.com'
);

notify pgrst, 'reload schema';
