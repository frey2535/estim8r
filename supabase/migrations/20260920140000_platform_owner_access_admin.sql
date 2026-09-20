-- Platform owner / backup admin can grant and revoke Estim8r access.
-- Browser clients cannot write product_entitlements; these RPCs are security definer.

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
begin
  if not public.current_is_platform_staff() then
    raise exception 'Only the platform owner or backup admin can manage Estim8r access.';
  end if;

  v_email := lower(trim(coalesce(target_email, '')));
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email is required.';
  end if;

  select * into v_profile
  from public.profiles
  where lower(email) = v_email
  order by created_at desc
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

    update public.profiles
    set access_status = 'active', access_type = 'owner_grant', updated_at = now()
    where id = v_profile.id;

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

  update public.product_entitlements e
  set status = 'revoked', updated_at = now()
  from public.profiles p
  where e.profile_id = p.id
    and e.product_key = 'estim8r'
    and lower(p.email) = v_email
    and e.status in ('active','trial');

  update public.profiles
  set access_status = 'revoked', updated_at = now()
  where lower(email) = v_email
    and lower(email) not in ('currentflowconsultingllc@gmail.com', 'marcus.a.frey@gmail.com');

  update public.product_access_invites
  set status = 'revoked', updated_at = now()
  where product_key = 'estim8r' and status = 'pending' and lower(email) = v_email;

  return jsonb_build_object('ok', true, 'email', v_email, 'action', 'revoked');
end;
$$;

grant execute on function public.revoke_estim8r_access(text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_org_name text;
  requested_invite text;
  target_org_id uuid;
  target_org_role text;
  has_owner_invite boolean;
begin
  requested_org_name := nullif(trim(coalesce(
    new.raw_user_meta_data->>'organization_name',
    new.raw_user_meta_data->>'company_name',
    ''
  )), '');
  requested_invite := nullif(upper(trim(coalesce(new.raw_user_meta_data->>'invite_code', ''))), '');
  has_owner_invite := exists (
    select 1
    from public.product_access_invites i
    where i.product_key = 'estim8r'
      and i.status = 'pending'
      and lower(i.email) = lower(coalesce(new.email, ''))
  );

  if requested_invite is not null then
    select id into target_org_id
    from public.organizations
    where upper(invite_code) = requested_invite
    limit 1;
    target_org_role := case when target_org_id is null then 'individual' else 'member' end;
  elsif requested_org_name is not null then
    insert into public.organizations(name, invite_code, access_status, purchase_source, seat_limit)
    values (
      requested_org_name,
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      'trial',
      'manual',
      1
    )
    returning id into target_org_id;
    target_org_role := 'owner';
  else
    target_org_id := null;
    target_org_role := 'individual';
  end if;

  insert into public.profiles(
    id,
    email,
    full_name,
    org_id,
    org_role,
    access_type,
    access_status,
    trial_start_date,
    trial_end_date,
    purchase_source
  )
  values (
    new.id,
    lower(coalesce(new.email,'')),
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name',''),
      split_part(lower(coalesce(new.email,'')), '@', 1)
    ),
    target_org_id,
    target_org_role,
    case when has_owner_invite then 'owner_grant' else 'trial' end,
    case when has_owner_invite then 'active' else 'trial' end,
    current_date,
    current_date + 30,
    case when has_owner_invite then 'platform_owner' else 'manual' end
  )
  on conflict (id) do nothing;

  insert into public.product_entitlements(
    product_key,
    profile_id,
    status,
    access_type,
    source,
    starts_at,
    expires_at
  )
  select
    'estim8r',
    new.id,
    case when has_owner_invite then 'active' else 'trial' end,
    case when has_owner_invite then 'owner_grant' else 'trial' end,
    case when has_owner_invite then 'platform_owner' else 'signup' end,
    now(),
    case when has_owner_invite then null else now() + interval '30 days' end
  where not exists (
    select 1
    from public.product_entitlements e
    where e.profile_id = new.id
      and e.product_key = 'estim8r'
  );

  update public.product_access_invites
  set status = 'consumed', updated_at = now()
  where product_key = 'estim8r'
    and status = 'pending'
    and lower(email) = lower(coalesce(new.email, ''));

  return new;
end;
$$;

update public.profiles
set is_platform_admin = true
where lower(email) in (
  'currentflowconsultingllc@gmail.com',
  'marcus.a.frey@gmail.com'
);
