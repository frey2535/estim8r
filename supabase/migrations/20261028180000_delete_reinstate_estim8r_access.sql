-- Live-safe Estim8r access delete / reinstate for the shared Current Flow project.
-- Delete removes Estim8r entitlement + invite rows from access management; it does
-- NOT delete auth.users or public.profiles.
-- Reinstate reuses grant_estim8r_access behavior.
-- Do not `supabase db push` the full Estim8r history onto the shared live project.
-- Apply with:
--   supabase link --project-ref gqdxvctvufalunaaopyj
--   supabase db query --linked --file supabase/migrations/20261028180000_delete_reinstate_estim8r_access.sql

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

  v_result := public.grant_estim8r_access(v_email);
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
