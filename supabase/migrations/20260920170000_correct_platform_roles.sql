-- One Current Flow platform owner. Marcus is backup admin, not a second owner.
-- Day One Electric is the first customer; mfrey@dayoneelectric.com is that company admin.

update public.profiles
set is_platform_admin = true
where lower(email) in (
  'currentflowconsultingllc@gmail.com',
  'marcus.a.frey@gmail.com'
);

update public.profiles
set is_platform_admin = false
where lower(email) = 'mfrey@dayoneelectric.com';

insert into public.organizations (name, invite_code, seat_limit, access_status, purchase_source)
select
  'Day One Electric',
  upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  5,
  'active',
  'admin'
where not exists (
  select 1 from public.organizations where lower(name) = 'day one electric'
);

update public.profiles p
set
  org_id = o.id,
  org_role = 'owner',
  is_platform_admin = false
from public.organizations o
where lower(p.email) = 'mfrey@dayoneelectric.com'
  and lower(o.name) = 'day one electric';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'updated_date'
  ) then
    update public.profiles
    set updated_date = now()
    where lower(email) in (
      'mfrey@dayoneelectric.com',
      'currentflowconsultingllc@gmail.com',
      'marcus.a.frey@gmail.com'
    );
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'updated_at'
  ) then
    update public.profiles
    set updated_at = now()
    where lower(email) in (
      'mfrey@dayoneelectric.com',
      'currentflowconsultingllc@gmail.com',
      'marcus.a.frey@gmail.com'
    );
  end if;
end;
$$;
