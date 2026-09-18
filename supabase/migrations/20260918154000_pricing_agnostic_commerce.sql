-- Pricing-agnostic Current Flow commerce architecture.
-- Catalog/prices can change without changing product entitlement or app code.

create table if not exists public.product_plans (
  id uuid primary key default gen_random_uuid(),
  product_key text not null,
  plan_key text not null,
  name text not null,
  description text,
  audience text not null default 'individual' check (audience in ('individual','company','either')),
  billing_model text not null default 'subscription' check (billing_model in ('one_time','subscription','trial','custom')),
  billing_interval text check (billing_interval in ('month','year')),
  currency text not null default 'USD',
  unit_amount integer,
  seat_min integer,
  seat_max integer,
  trial_days integer,
  bundle_key text,
  provider text,
  provider_price_id text,
  is_public boolean not null default false,
  is_active boolean not null default false,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_key, plan_key)
);

create table if not exists public.purchase_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  profile_id uuid references public.profiles(id) on delete set null,
  org_id uuid references public.organizations(id) on delete set null,
  product_key text,
  plan_key text,
  provider_customer_id text,
  provider_subscription_id text,
  provider_transaction_id text,
  amount integer,
  currency text,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

alter table public.product_plans enable row level security;
alter table public.purchase_events enable row level security;

drop policy if exists "public active plans read" on public.product_plans;
create policy "public active plans read" on public.product_plans
for select to anon, authenticated
using (is_active and is_public);

drop policy if exists "purchase events own read" on public.purchase_events;
create policy "purchase events own read" on public.purchase_events
for select to authenticated
using (
  public.current_is_platform_admin()
  or profile_id = auth.uid()
  or (org_id is not null and org_id = public.current_profile_org_id())
);

grant select on public.product_plans to anon, authenticated;
grant select on public.purchase_events to authenticated;

-- No public INSERT/UPDATE/DELETE grants are intentionally provided.
-- Trusted payment webhooks/admin services fulfill purchases using privileged credentials.

-- Placeholder catalog record: no price and not public/active.
-- This lets product code reference a stable plan key without committing to pricing.
insert into public.product_plans (
  product_key, plan_key, name, description, audience, billing_model,
  unit_amount, is_public, is_active, metadata
) values (
  'estim8r', 'estim8r_default', 'Estim8r',
  'Pricing to be configured before commercial launch.',
  'either', 'custom', null, false, false,
  '{"pricing_status":"undecided"}'::jsonb
)
on conflict (product_key, plan_key) do nothing;
