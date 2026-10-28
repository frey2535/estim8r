-- Company users opening Estim8r from the Buildr sidebar can authenticate into
-- auth.users without a public.profiles row (missing/failed signup trigger on the
-- shared Current Flow project). Auth then fails with "profile has not been
-- provisioned" before Buildr Access Control grants are applied.
--
-- This RPC is security definer, idempotent, and schema-adaptive for the live
-- shared project (created_date/updated_date) and Estim8r-local (created_at).
-- It does NOT invent product entitlements — Buildr company access stays on the
-- verified family-app handoff. Do not replace handle_new_user here.

create or replace function public.ensure_current_flow_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_email text;
  v_full_name text;
  v_has_updated_date boolean;
  v_has_updated_at boolean;
  v_has_access_type boolean;
  v_has_access_status boolean;
  v_has_purchase_source boolean;
  v_org_role text := 'individual';
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_uid;

  if v_profile.id is not null then
    return v_profile;
  end if;

  select
    lower(coalesce(u.email, '')),
    coalesce(
      nullif(u.raw_user_meta_data->>'full_name', ''),
      split_part(lower(coalesce(u.email, '')), '@', 1)
    )
  into v_email, v_full_name
  from auth.users u
  where u.id = v_uid;

  if coalesce(v_email, '') = '' then
    raise exception 'Authenticated user has no email for profile provisioning';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'updated_date'
  ) into v_has_updated_date;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'updated_at'
  ) into v_has_updated_at;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'access_type'
  ) into v_has_access_type;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'access_status'
  ) into v_has_access_status;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'purchase_source'
  ) into v_has_purchase_source;

  -- Prefer individual when allowed; fall back to member+null org on older CHECKs.
  begin
    insert into public.profiles (id, email, full_name, org_id, org_role)
    values (v_uid, v_email, v_full_name, null, v_org_role)
    on conflict (id) do nothing;
  exception
    when check_violation then
      v_org_role := 'member';
      insert into public.profiles (id, email, full_name, org_id, org_role)
      values (v_uid, v_email, v_full_name, null, v_org_role)
      on conflict (id) do nothing;
  end;

  if v_has_access_type then
    execute 'update public.profiles set access_type = coalesce(access_type, $1) where id = $2'
      using 'trial', v_uid;
  end if;
  if v_has_access_status then
    execute 'update public.profiles set access_status = coalesce(access_status, $1) where id = $2'
      using 'trial', v_uid;
  end if;
  if v_has_purchase_source then
    execute 'update public.profiles set purchase_source = coalesce(purchase_source, $1) where id = $2'
      using 'manual', v_uid;
  end if;
  if v_has_updated_at then
    execute 'update public.profiles set updated_at = now() where id = $1'
      using v_uid;
  end if;
  if v_has_updated_date then
    execute 'update public.profiles set updated_date = now() where id = $1'
      using v_uid;
  end if;

  select * into v_profile
  from public.profiles
  where id = v_uid;

  if v_profile.id is null then
    raise exception 'Unable to provision Current Flow profile';
  end if;

  return v_profile;
end;
$$;

grant execute on function public.ensure_current_flow_profile() to authenticated;

notify pgrst, 'reload schema';
