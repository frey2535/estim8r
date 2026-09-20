-- Store the Buildr company used for Estim8r document sync, and mark
-- the Current Flow platform owner / backup admin when those profiles exist.

alter table public.profiles
  add column if not exists buildr_company_id text;

revoke update on public.profiles from anon, authenticated;
grant update (full_name, updated_at, buildr_company_id) on public.profiles to authenticated;

update public.profiles
set is_platform_admin = true
where lower(email) in (
  'currentflowconsultingllc@gmail.com',
  'marcus.a.frey@gmail.com'
);
