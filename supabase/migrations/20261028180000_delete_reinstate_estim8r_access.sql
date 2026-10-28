-- Live-safe Estim8r access delete / reinstate + list filter for the shared
-- Current Flow project.
--
-- Delete removes Estim8r entitlement + invite rows from access management; it
-- does NOT delete auth.users or public.profiles.
-- Reinstate restores access via grant_estim8r_access.
-- list_estim8r_access only returns staff, users with an Estim8r entitlement,
-- and pending invites — so Delete removes the row from the admin table.
--
-- Apply with:
--   supabase link --project-ref gqdxvctvufalunaaopyj
--   supabase db query --linked --file supabase/migrations/20261028180000_delete_reinstate_estim8r_access.sql

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
  where
    lower(p.email) in (
      'currentflowconsultingllc@gmail.com',
      'marcus.a.frey@gmail.com'
    )
    or e.status is not null
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

create or replace function public.delete_estim8r_access(target_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_has_updated_date boolean;
  v_removed_entitlements integer := 0;
  v_removed_invites integer := 0;
begin
  if not public.current_is_platform_staff() then
    raise exception 'Only the platform owner or backup admin can manage Estim8r access.';
  end if;

  v_email := lower(trim(coalesce(target_email, '')));
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email is required.';
  end if;
  if v_email in ('currentflowconsultingllc@gmail.com', 'marcus.a.frey@gmail.com') then
    raise exception 'Cannot delete platform owner or backup admin access.';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'updated_date'
  ) into v_has_updated_date;

  with deleted as (
    delete from public.product_entitlements e
    using public.profiles p
    where e.profile_id = p.id
      and e.product_key = 'estim8r'
      and lower(p.email) = v_email
    returning e.id
  )
  select count(*)::integer into v_removed_entitlements from deleted;

  with cancelled as (
    delete from public.product_access_invites i
    where i.product_key = 'estim8r'
      and lower(i.email) = v_email
    returning i.id
  )
  select count(*)::integer into v_removed_invites from cancelled;

  if v_has_updated_date then
    update public.profiles
    set
      access_status = 'disabled',
      updated_date = now()
    where lower(email) = v_email
      and lower(email) not in ('currentflowconsultingllc@gmail.com', 'marcus.a.frey@gmail.com');
  else
    update public.profiles
    set
      access_status = 'revoked',
      updated_at = now()
    where lower(email) = v_email
      and lower(email) not in ('currentflowconsultingllc@gmail.com', 'marcus.a.frey@gmail.com');
  end if;

  return jsonb_build_object(
    'ok', true,
    'email', v_email,
    'action', 'deleted',
    'removed_entitlements', v_removed_entitlements,
    'removed_invites', v_removed_invites
  );
end;
$$;

grant execute on function public.delete_estim8r_access(text) to authenticated;

create or replace function public.reinstate_estim8r_access(target_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_result jsonb;
begin
  if not public.current_is_platform_staff() then
    raise exception 'Only the platform owner or backup admin can manage Estim8r access.';
  end if;

  v_email := lower(trim(coalesce(target_email, '')));
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email is required.';
  end if;
  if v_email in ('currentflowconsultingllc@gmail.com', 'marcus.a.frey@gmail.com') then
    raise exception 'Cannot reinstate platform owner or backup admin access.';
  end if;

  -- Inline the grant path so reinstate works even when nested CALL permissions
  -- or an older grant signature would otherwise fail the dedicated RPC.
  v_result := public.grant_estim8r_access(v_email);
  if v_result is null or coalesce((v_result->>'ok')::boolean, false) is not true then
    raise exception 'Unable to reinstate Estim8r access for %', v_email;
  end if;

  return jsonb_build_object(
    'ok', true,
    'email', v_email,
    'action', 'reinstated',
    'grant', v_result
  );
end;
$$;

grant execute on function public.reinstate_estim8r_access(text) to authenticated;

notify pgrst, 'reload schema';
