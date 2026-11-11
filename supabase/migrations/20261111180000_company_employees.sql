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

-- A pending invitation is not a membership. Acceptance requires a signed-in,
-- email-confirmed account matching the invitation exactly.
create or replace function public.estim8r_accept_company_invitation()
returns boolean language plpgsql security definer set search_path=public as $$
declare v_email text; v_confirmed timestamptz; v_org uuid; v_existing uuid; v_matches integer;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select lower(u.email),u.email_confirmed_at into v_email,v_confirmed
 from auth.users u where u.id=auth.uid();
 if v_confirmed is null then raise exception 'Verify your email before joining a company'; end if;
 select p.org_id into v_existing from public.profiles p where p.id=auth.uid();
 if v_existing is not null then raise exception 'Account already belongs to an organization'; end if;
 select count(*),min(i.org_id) into v_matches,v_org
 from public.estim8r_company_invitations i where i.email=v_email;
 if v_matches <> 1 then raise exception 'Exactly one company invitation is required'; end if;
 update public.profiles p set org_id=v_org where p.id=auth.uid() and p.org_id is null;
 if not found then raise exception 'Account profile missing or company already assigned'; end if;
 delete from public.estim8r_company_invitations i where i.org_id=v_org and i.email=v_email;
 return true;
end $$;
revoke all on function public.estim8r_accept_company_invitation() from public;
grant execute on function public.estim8r_accept_company_invitation() to authenticated;
