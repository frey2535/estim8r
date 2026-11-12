-- Company access management. Does not delete shared auth accounts.
create table if not exists public.estim8r_company_access_blocks (
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (org_id,email)
);
alter table public.estim8r_company_access_blocks enable row level security;
revoke all on public.estim8r_company_access_blocks from anon, authenticated;

create or replace function public.estim8r_manage_company_employee(p_email text, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_role text;
  v_email text := lower(trim(coalesce(p_email,'')));
  v_target uuid;
  v_target_role text;
begin
  select org_id,org_role::text into v_org,v_role
  from public.profiles where id=auth.uid();
  if v_org is null or v_role not in ('owner','admin','company_admin') then
    raise exception 'Company administrator permission required';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Valid email required';
  end if;
  if p_action not in ('grant','revoke','delete') then
    raise exception 'Unsupported action';
  end if;
  if v_email = (select lower(email) from auth.users where id=auth.uid()) then
    raise exception 'Cannot change your own company access';
  end if;
  select p.id,p.org_role::text into v_target,v_target_role
  from public.profiles p join auth.users u on u.id=p.id
  where p.org_id=v_org and lower(u.email)=v_email;
  if v_target_role in ('owner','admin','company_admin') then
    raise exception 'Cannot change another company administrator';
  end if;
  if p_action in ('revoke','delete') then
    if p_action = 'revoke' then
      insert into public.estim8r_company_access_blocks(org_id,email)
      values(v_org,v_email) on conflict do nothing;
    else
      delete from public.estim8r_company_access_blocks where org_id=v_org and email=v_email;
    end if;
    delete from public.estim8r_company_invitations
    where org_id=v_org and lower(email)=v_email;
    -- Remove tenant membership. Do not delete the shared auth account.
    if v_target is not null then
      update public.profiles set org_id=null
      where id=v_target and org_id=v_org;
    end if;
  else
    delete from public.estim8r_company_access_blocks
    where org_id=v_org and email=v_email;
    -- Only restore an unassigned account; never transfer between companies.
    if exists (
      select 1 from public.profiles p join auth.users u on u.id=p.id
      where lower(u.email)=v_email and p.org_id is not null and p.org_id<>v_org
    ) then raise exception 'Account belongs to another company'; end if;
    insert into public.estim8r_company_invitations(org_id,email)
    values(v_org,v_email) on conflict do nothing;
  end if;
end $$;
revoke all on function public.estim8r_manage_company_employee(text,text) from public,anon;
grant execute on function public.estim8r_manage_company_employee(text,text) to authenticated;

-- The directory includes blocked accounts and reflects their actual state.
create or replace function public.estim8r_company_employees()
returns table(email text,role text,status text)
language plpgsql security definer set search_path=public as $$
declare v_org uuid;
begin
 select org_id into v_org from public.profiles where id=auth.uid();
 if v_org is null then raise exception 'Company membership required'; end if;
 return query
 select lower(u.email)::text,p.org_role::text,'active'::text
 from public.profiles p join auth.users u on u.id=p.id where p.org_id=v_org
 union all
 select i.email,i.role,'invited'::text
 from public.estim8r_company_invitations i where i.org_id=v_org
 and not exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.org_id=v_org and lower(u.email)=lower(i.email))
 union all
 select b.email,'individual'::text,'revoked'::text
 from public.estim8r_company_access_blocks b where b.org_id=v_org;
end $$;
revoke all on function public.estim8r_company_employees() from public,anon;
grant execute on function public.estim8r_company_employees() to authenticated;

-- Revoked email must not be reactivated by an old invitation.
create or replace function public.estim8r_activate_invited_employee()
returns boolean language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();v_email text;v_confirmed timestamptz;v_org uuid;v_count integer;v_current uuid;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 select lower(trim(email)),email_confirmed_at into v_email,v_confirmed from auth.users where id=v_uid;
 if v_confirmed is null then return false; end if;
 select org_id into v_current from public.profiles where id=v_uid;
 if not found or v_current is not null then return false; end if;
 select count(*),min(i.org_id) into v_count,v_org from public.estim8r_company_invitations i
 where lower(trim(i.email))=v_email
 and not exists(select 1 from public.estim8r_company_access_blocks b where b.org_id=i.org_id and b.email=v_email);
 if v_count<>1 then return false; end if;
 update public.profiles set org_id=v_org where id=v_uid and org_id is null;
 if not found then return false; end if;
 delete from public.estim8r_company_invitations where org_id=v_org and lower(trim(email))=v_email;
 return true;
end $$;
revoke all on function public.estim8r_activate_invited_employee() from public,anon;
grant execute on function public.estim8r_activate_invited_employee() to authenticated;
notify pgrst,'reload schema';
