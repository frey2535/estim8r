-- Extend Estim8r identity to the shared Current Flow account model.
-- Additive and backward-compatible with existing Estim8r organization ownership/RLS.

alter table public.organizations
  add column if not exists invite_code text,
  add column if not exists access_status text not null default 'trial',
  add column if not exists purchase_source text not null default 'manual',
  add column if not exists seat_limit integer;

create unique index if not exists organizations_invite_code_key
  on public.organizations(invite_code)
  where invite_code is not null;

update public.organizations
set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where invite_code is null;

alter table public.profiles
  add column if not exists access_type text not null default 'trial',
  add column if not exists access_status text not null default 'trial',
  add column if not exists trial_start_date date,
  add column if not exists trial_end_date date,
  add column if not exists purchase_source text not null default 'manual',
  add column if not exists subscription_status text;

alter table public.profiles drop constraint if exists profiles_org_role_check;
alter table public.profiles
  add constraint profiles_org_role_check
  check (org_role in ('owner','member','individual'));

create or replace function public.organization_by_invite(code text)
returns table(id uuid, name text, invite_code text)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.name, o.invite_code
  from public.organizations o
  where upper(o.invite_code) = upper(trim(code))
  limit 1;
$$;

grant execute on function public.organization_by_invite(text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_org_name text;
  requested_invite text;
  target_org_id uuid;
  target_org_role text;
begin
  requested_org_name := nullif(trim(coalesce(
    new.raw_user_meta_data->>'organization_name',
    new.raw_user_meta_data->>'company_name',
    ''
  )), '');
  requested_invite := nullif(upper(trim(coalesce(new.raw_user_meta_data->>'invite_code', ''))), '');

  if requested_invite is not null then
    select id into target_org_id
    from public.organizations
    where upper(invite_code) = requested_invite
    limit 1;
    target_org_role := case when target_org_id is null then 'individual' else 'member' end;
  elsif requested_org_name is not null then
    insert into public.organizations(name, invite_code, access_status, purchase_source, seat_limit)
    values (
      requested_org_name,
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      'trial',
      'manual',
      1
    )
    returning id into target_org_id;
    target_org_role := 'owner';
  else
    target_org_id := null;
    target_org_role := 'individual';
  end if;

  insert into public.profiles(
    id,
    email,
    full_name,
    org_id,
    org_role,
    access_type,
    access_status,
    trial_start_date,
    trial_end_date,
    purchase_source
  )
  values (
    new.id,
    lower(coalesce(new.email,'')),
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name',''),
      split_part(lower(coalesce(new.email,'')), '@', 1)
    ),
    target_org_id,
    target_org_role,
    'trial',
    'trial',
    current_date,
    current_date + 30,
    'manual'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Existing organizations remain owners/members; only null-org profiles become individual.
update public.profiles
set org_role = 'individual'
where org_id is null and org_role <> 'individual';
