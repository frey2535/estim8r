-- Enable company-scoped snapshot change notifications for all tenants.
-- Existing RLS policies continue to restrict snapshot reads and writes.
-- Realtime clients must refresh through authenticated SELECT; never trust a
-- change notification as authorization to read another organization's data.
do $$
begin
  if to_regclass('public.estim8r_estimate_snapshots') is null then
    raise exception 'estim8r_estimate_snapshots missing: apply earlier snapshot migrations first';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'estim8r_estimate_snapshots'
  ) then
    alter publication supabase_realtime add table public.estim8r_estimate_snapshots;
  end if;
end $$;
-- Old-row organization identifiers are needed to filter DELETE notifications.
alter table public.estim8r_estimate_snapshots replica identity full;
