-- Passive issue reporting: no AI calls, no Cursor sessions, no screenshot capture.
create table if not exists public.estim8r_issue_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null default auth.uid(),
 route text not null check (char_length(route) between 1 and 200),
 category text not null check (category in ('render_crash','server_error','unhandled_error')),
 occurrences integer not null default 1,
 created_at timestamptz not null default now()
);
create index if not exists estim8r_issue_reports_recent_idx on public.estim8r_issue_reports(created_at desc);
alter table public.estim8r_issue_reports enable row level security;
revoke all on public.estim8r_issue_reports from anon;
grant insert, select on public.estim8r_issue_reports to authenticated;
create policy "Users may report their own errors" on public.estim8r_issue_reports
 for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "Only platform owner may read incidents" on public.estim8r_issue_reports
 for select to authenticated using (
  lower(coalesce((select auth.jwt())->>'email','')) = 'currentflowconsultingllc@gmail.com'
 );
