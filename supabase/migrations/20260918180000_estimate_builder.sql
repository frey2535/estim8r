-- Estim8r estimate header and line-item foundation.
-- Safe to share a Supabase project: all tables are Estim8r-specific and org-isolated.

create table if not exists public.estim8r_customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  company_name text,
  contact_name text,
  phone text,
  email text,
  billing_address text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estim8r_estimates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  estimate_number text,
  project_name text not null,
  project_address text,
  customer_id uuid references public.estim8r_customers(id) on delete set null,
  customer_name text,
  customer_company text,
  customer_phone text,
  customer_email text,
  status text not null default 'draft' check (status in ('draft','in_progress','review','submitted','awarded','lost','archived')),
  bid_due_at timestamptz,
  estimator_name text,
  scope_notes text,
  exclusions text,
  clarifications text,
  tax_rate numeric not null default 0,
  overhead_percent numeric not null default 0,
  profit_percent numeric not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estim8r_estimate_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  estimate_id uuid not null references public.estim8r_estimates(id) on delete cascade,
  sort_order integer not null default 0,
  item_type text not null default 'material',
  category text,
  description text not null,
  manufacturer text,
  model text,
  size text,
  quantity numeric not null default 1 check (quantity >= 0),
  unit text not null default 'EA',
  material_unit_cost numeric not null default 0 check (material_unit_cost >= 0),
  labor_item_id uuid references public.labor_items(id) on delete set null,
  labor_mh_per_unit numeric not null default 0 check (labor_mh_per_unit >= 0),
  labor_rate numeric not null default 0 check (labor_rate >= 0),
  equipment_cost numeric not null default 0 check (equipment_cost >= 0),
  subcontract_cost numeric not null default 0 check (subcontract_cost >= 0),
  notes text,
  source text not null default 'manual' check (source in ('manual','takeoff','imported','ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estim8r_customers_org_idx on public.estim8r_customers(org_id, company_name, contact_name);
create index if not exists estim8r_estimates_org_status_idx on public.estim8r_estimates(org_id, status, created_at desc);
create index if not exists estim8r_estimate_lines_estimate_idx on public.estim8r_estimate_lines(estimate_id, sort_order);

alter table public.estim8r_customers enable row level security;
alter table public.estim8r_estimates enable row level security;
alter table public.estim8r_estimate_lines enable row level security;

do $$
declare t text;
begin
  foreach t in array array['estim8r_customers','estim8r_estimates','estim8r_estimate_lines']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_org_access', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.current_is_platform_admin() or org_id = public.current_profile_org_id()) with check (public.current_is_platform_admin() or org_id = public.current_profile_org_id())',
      t || '_org_access', t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
