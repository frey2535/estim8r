-- Platform owner and backup admin always have Estim8r, even without a row.
-- current_product_entitlement is what the browser gate calls.

create or replace function public.current_product_entitlement(requested_product text)
returns table(
  product_key text,
  status text,
  access_type text,
  source text,
  bundle_key text,
  seats integer,
  expires_at timestamptz,
  metadata jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if requested_product = 'estim8r' and public.current_is_platform_staff() then
    return query
    select
      'estim8r'::text,
      'active'::text,
      'owner_grant'::text,
      'platform_owner'::text,
      null::text,
      null::integer,
      null::timestamptz,
      '{}'::jsonb;
    return;
  end if;

  return query
  select e.product_key, e.status, e.access_type, e.source, e.bundle_key, e.seats, e.expires_at, e.metadata
  from public.product_entitlements e
  where e.product_key = requested_product
    and (e.profile_id = auth.uid() or e.org_id = public.current_profile_org_id())
    and e.status in ('active','trial')
    and (e.expires_at is null or e.expires_at >= now())
  order by
    case when e.status = 'active' then 0 else 1 end,
    e.expires_at desc nulls first,
    e.created_at desc
  limit 1;
end;
$$;

grant execute on function public.current_product_entitlement(text) to authenticated;

notify pgrst, 'reload schema';
