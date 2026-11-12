-- Accurate company access states: active requires verified email and company membership.
-- Keep the existing three-column RPC signature for compatibility.
create or replace function public.estim8r_company_employees()
returns table(email text, role text, status text)
language plpgsql stable security definer set search_path = public
as $$
declare v_org uuid;
begin
  select p.org_id into v_org from public.profiles p where p.id = auth.uid();
  if v_org is null then raise exception 'Company membership required'; end if;
  return query
  select lower(trim(u.email))::text, p.org_role::text,
    case when u.email_confirmed_at is not null then 'active' else 'pending_verification' end::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.org_id = v_org
    and not exists (
      select 1 from public.estim8r_company_access_blocks b
      where b.org_id = v_org and b.email = lower(trim(u.email))
    )
  union all
  select lower(trim(i.email))::text, i.role,
    'preauthorized'::text
  from public.estim8r_company_invitations i
  where i.org_id = v_org
    and not exists (
      select 1 from public.profiles p join auth.users u on u.id = p.id
      where p.org_id = v_org and lower(trim(u.email)) = lower(trim(i.email))
    )
    and not exists (
      select 1 from public.estim8r_company_access_blocks b
      where b.org_id = v_org and b.email = lower(trim(i.email))
    )
  union all
  select b.email, 'individual'::text, 'revoked'::text
  from public.estim8r_company_access_blocks b
  where b.org_id = v_org;
end $$;
revoke all on function public.estim8r_company_employees() from public, anon;
grant execute on function public.estim8r_company_employees() to authenticated;
notify pgrst, 'reload schema';
