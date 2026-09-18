-- Restrict PostgREST profile updates to non-privilege columns.
-- RLS still identifies the row owner; column grants stop self-escalation of
-- is_platform_admin, role, org_id, org_role, and access/trial fields.
-- Signup remains on the security-definer trigger (no INSERT grant).

revoke update on public.profiles from anon, authenticated;
grant update (full_name, updated_at) on public.profiles to authenticated;
