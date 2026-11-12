-- Automatically activate a company invitation after the employee signs in.
-- The verified auth email must match exactly; never reassign existing members.
create or replace function public.estim8r_activate_invited_employee()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_org uuid;
  v_count integer;
  v_current uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select lower(trim(u.email)), u.email_confirmed_at
    into v_email, v_confirmed from auth.users u where u.id = v_uid;
  if v_confirmed is null then return false; end if;
  select p.org_id into v_current from public.profiles p where p.id = v_uid;
  if not found or v_current is not null then return false; end if;
  select count(*), min(i.org_id) into v_count, v_org
    from public.estim8r_company_invitations i
    where lower(trim(i.email)) = v_email;
  if v_count <> 1 then return false; end if;
  update public.profiles set org_id = v_org where id = v_uid and org_id is null;
  if not found then return false; end if;
  delete from public.estim8r_company_invitations
    where org_id = v_org and lower(trim(email)) = v_email;
  return true;
end $$;
revoke all on function public.estim8r_activate_invited_employee() from public, anon;
grant execute on function public.estim8r_activate_invited_employee() to authenticated;
notify pgrst, 'reload schema';
