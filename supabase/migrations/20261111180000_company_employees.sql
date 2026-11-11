create table if not exists public.estim8r_company_invitations (
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'employee',
  created_at timestamptz not null default now(),
  primary key(org_id,email)
);
alter table public.estim8r_company_invitations enable row level security;
revoke all on public.estim8r_company_invitations from anon,authenticated;

create or replace function public.estim8r_company_employees()
returns table(email text, role text, status text)
language plpgsql security definer set search_path=public as $$
declare v_org uuid;
begin
 select p.org_id into v_org from public.profiles p where p.id=auth.uid();
 if v_org is null then raise exception 'Company membership required'; end if;
 return query
 select lower(u.email)::text,coalesce(p.org_role::text,'employee'),'active'::text
 from public.profiles p join auth.users u on u.id=p.id where p.org_id=v_org
 union all
 select i.email,i.role,'invited'::text from public.estim8r_company_invitations i
 where i.org_id=v_org and not exists (
   select 1 from public.profiles p join auth.users u on u.id=p.id
   where p.org_id=v_org and lower(u.email)=i.email);
end $$;

create or replace function public.estim8r_invite_company_employee(p_email text)
returns void language plpgsql security definer set search_path=public as $$
declare v_org uuid; v_role text; v_email text;
begin
 select p.org_id,p.org_role::text into v_org,v_role from public.profiles p where p.id=auth.uid();
 if v_org is null or v_role not in ('owner','admin','company_admin') then
   raise exception 'Company administrator permission required';
 end if;
 v_email:=lower(trim(p_email));
 if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Valid email required'; end if;
 insert into public.estim8r_company_invitations(org_id,email) values(v_org,v_email)
 on conflict(org_id,email) do nothing;
end $$;
revoke all on function public.estim8r_company_employees() from public;
revoke all on function public.estim8r_invite_company_employee(text) from public;
grant execute on function public.estim8r_company_employees() to authenticated;
grant execute on function public.estim8r_invite_company_employee(text) to authenticated;
