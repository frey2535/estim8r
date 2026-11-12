-- Allow authenticated company members to delete company estimate snapshots.
-- RLS checks the caller's current organization, not a client-provided company ID.
drop policy if exists estim8r_snapshots_delete on public.estim8r_estimate_snapshots;
create policy estim8r_snapshots_delete on public.estim8r_estimate_snapshots
for delete to authenticated using (org_id = public.current_profile_org_id());
grant delete on public.estim8r_estimate_snapshots to authenticated;
