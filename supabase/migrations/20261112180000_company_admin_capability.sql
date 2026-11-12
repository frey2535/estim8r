-- Server-authoritative capability check for company management UI.
create or replace function public.estim8r_can_manage_company_employees()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id is not null
      and p.org_role::text in ('owner','admin','company_admin')
  );
$$;
revoke all on function public.estim8r_can_manage_company_employees() from public, anon;
grant execute on function public.estim8r_can_manage_company_employees() to authenticated;
notify pgrst, 'reload schema';
