-- Automatically attach an existing, verified account when a company admin adds its email.
-- Company names are resolved through the organizations relation using profiles.org_id.
-- Never overwrite another organization's membership or elevate the employee's role.
create or replace function public.estim8r_invite_company_employee(p_email text)
returns void language plpgsql security definer set search_path=public as $$
declare
 v_org uuid; v_role text; v_email text:=lower(trim(coalesce(p_email,'')));
 v_uid uuid; v_confirmed timestamptz; v_existing_org uuid; v_existing_role text;
begin
 select org_id,org_role::text into v_org,v_role from public.profiles where id=auth.uid();
 if v_org is null or v_role not in ('owner','admin','company_admin') then
   raise exception 'Company administrator permission required';
 end if;
 if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
   raise exception 'Valid email required';
 end if;
 select id,email_confirmed_at into v_uid,v_confirmed from auth.users
 where lower(trim(email))=v_email;
 if v_uid=auth.uid() then raise exception 'Cannot add your own account'; end if;
 if v_uid is not null then
   select org_id,org_role::text into v_existing_org,v_existing_role
   from public.profiles where id=v_uid for update;
   if v_existing_org is not null and v_existing_org<>v_org then
     raise exception 'Employee account belongs to another company';
   end if;
   if v_existing_role in ('owner','admin','company_admin') and v_existing_org is distinct from v_org then
     raise exception 'Cannot reassign an administrator account';
   end if;
 end if;
 -- Explicit admin reauthorization removes a prior revocation.
 delete from public.estim8r_company_access_blocks
 where org_id=v_org and email=v_email;
 if v_uid is not null and v_confirmed is not null then
   -- Existing accounts must have a profile; do not synthesize one without required fields.
   update public.profiles set org_id=v_org
   where id=v_uid and org_id is null;
   if not exists(select 1 from public.profiles where id=v_uid and org_id=v_org) then
     raise exception 'Unable to associate employee account';
   end if;
   delete from public.estim8r_company_invitations
   where org_id=v_org and lower(trim(email))=v_email;
 else
   insert into public.estim8r_company_invitations(org_id,email)
   values(v_org,v_email) on conflict(org_id,email) do nothing;
 end if;
end $$;
revoke all on function public.estim8r_invite_company_employee(text) from public,anon;
grant execute on function public.estim8r_invite_company_employee(text) to authenticated;

-- Grant/restore must use the same existing-account association path.
create or replace function public.estim8r_manage_company_employee(p_email text,p_action text)
returns void language plpgsql security definer set search_path=public as $$
declare
 v_org uuid;v_role text;v_email text:=lower(trim(coalesce(p_email,'')));
 v_target uuid;v_target_role text;
begin
 select org_id,org_role::text into v_org,v_role from public.profiles where id=auth.uid();
 if v_org is null or v_role not in ('owner','admin','company_admin') then
   raise exception 'Company administrator permission required';
 end if;
 if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
   raise exception 'Valid email required';
 end if;
 if p_action not in ('grant','revoke','delete') then raise exception 'Unsupported action'; end if;
 if v_email=(select lower(email) from auth.users where id=auth.uid()) then
   raise exception 'Cannot change your own company access';
 end if;
 select p.id,p.org_role::text into v_target,v_target_role
 from public.profiles p join auth.users u on u.id=p.id
 where p.org_id=v_org and lower(trim(u.email))=v_email;
 if v_target_role in ('owner','admin','company_admin') then
   raise exception 'Cannot change another company administrator';
 end if;
 if p_action='grant' then
   perform public.estim8r_invite_company_employee(v_email);
   return;
 end if;
 if p_action='revoke' then
   insert into public.estim8r_company_access_blocks(org_id,email)
   values(v_org,v_email) on conflict do nothing;
 else
   delete from public.estim8r_company_access_blocks where org_id=v_org and email=v_email;
 end if;
 delete from public.estim8r_company_invitations where org_id=v_org and lower(trim(email))=v_email;
 if v_target is not null then
   update public.profiles set org_id=null where id=v_target and org_id=v_org;
 end if;
end $$;
revoke all on function public.estim8r_manage_company_employee(text,text) from public,anon;
grant execute on function public.estim8r_manage_company_employee(text,text) to authenticated;
notify pgrst,'reload schema';
