-- Grant a 30-day Estim8r product entitlement on signup.
-- handle_new_user() already writes profile trial fields but never inserts
-- product_entitlements; the client fail-closes on current_product_entitlement.
-- Trigger is security definer, so it can insert despite SELECT-only grants.
-- No browser INSERT grant on product_entitlements.

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

  insert into public.product_entitlements(
    product_key,
    profile_id,
    status,
    access_type,
    source,
    starts_at,
    expires_at
  )
  select
    'estim8r',
    new.id,
    'trial',
    'trial',
    'signup',
    now(),
    now() + interval '30 days'
  where not exists (
    select 1
    from public.product_entitlements e
    where e.profile_id = new.id
      and e.product_key = 'estim8r'
  );

  return new;
end;
$$;

insert into public.product_entitlements(
  product_key,
  profile_id,
  status,
  access_type,
  source,
  starts_at,
  expires_at
)
select
  'estim8r',
  p.id,
  'trial',
  'trial',
  'signup',
  coalesce(p.trial_start_date::timestamptz, now()),
  coalesce(p.trial_end_date::timestamptz, now() + interval '30 days')
from public.profiles p
where not exists (
  select 1
  from public.product_entitlements e
  where e.profile_id = p.id
    and e.product_key = 'estim8r'
);
