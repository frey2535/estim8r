-- Core Estim8r identity and tenancy foundation.
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('user','admin')),
  is_platform_admin boolean not null default false,
  org_id uuid references public.organizations(id) on delete set null,
  org_role text not null default 'member' check (org_role in ('owner','member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

create or replace function public.current_is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.current_profile_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_profile_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_can_manage_codebook()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_is_platform_admin() or coalesce(public.current_profile_role(), '') = 'admin';
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_org_id uuid;
begin
  insert into public.organizations(name)
  values (coalesce(nullif(new.raw_user_meta_data->>'company_name',''), 'My Company'))
  returning id into new_org_id;

  insert into public.profiles(id, email, full_name, org_id, org_role)
  values (
    new.id,
    lower(coalesce(new.email,'')),
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(lower(coalesce(new.email,'')), '@', 1)),
    new_org_id,
    'owner'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop policy if exists "organizations own read" on public.organizations;
create policy "organizations own read" on public.organizations for select to authenticated
using (public.current_is_platform_admin() or id = public.current_profile_org_id());

drop policy if exists "organizations own update" on public.organizations;
create policy "organizations own update" on public.organizations for update to authenticated
using (public.current_is_platform_admin() or id = public.current_profile_org_id())
with check (public.current_is_platform_admin() or id = public.current_profile_org_id());

drop policy if exists "profiles own org read" on public.profiles;
create policy "profiles own org read" on public.profiles for select to authenticated
using (public.current_is_platform_admin() or id = auth.uid() or org_id = public.current_profile_org_id());

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update to authenticated
using (public.current_is_platform_admin() or id = auth.uid())
with check (public.current_is_platform_admin() or id = auth.uid());

grant select, update on public.organizations to authenticated;
grant select, update on public.profiles to authenticated;
