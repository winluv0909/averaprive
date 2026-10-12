begin;

create extension if not exists pgcrypto;
create schema if not exists ap_private;

create table if not exists public.ap_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ap_agency_memberships (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.ap_agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','editor','analyst','billing')),
  status text not null default 'active' check (status in ('invited','active','suspended','revoked')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, user_id)
);

create table if not exists public.ap_staff_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin','moderator','verification_reviewer','support','finance','editor')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists public.ap_security_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  agency_id uuid references public.ap_agencies(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function ap_private.is_staff(required_roles text[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ap_staff_roles r
    where r.user_id = auth.uid()
      and (required_roles is null or r.role = any(required_roles))
  );
$$;

create or replace function ap_private.has_agency_role(target_agency uuid, required_roles text[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ap_agency_memberships m
    where m.agency_id = target_agency
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (required_roles is null or m.role = any(required_roles))
  );
$$;

revoke all on schema ap_private from public, anon, authenticated;
grant usage on schema ap_private to authenticated;
revoke all on function ap_private.is_staff(text[]) from public;
revoke all on function ap_private.has_agency_role(uuid,text[]) from public;
grant execute on function ap_private.is_staff(text[]) to authenticated;
grant execute on function ap_private.has_agency_role(uuid,text[]) to authenticated;

alter table public.ap_user_profiles enable row level security;
alter table public.ap_agency_memberships enable row level security;
alter table public.ap_staff_roles enable row level security;
alter table public.ap_security_audit enable row level security;

drop policy if exists "profiles_read_own" on public.ap_user_profiles;
create policy "profiles_read_own" on public.ap_user_profiles for select to authenticated
using (user_id = auth.uid() or ap_private.is_staff(array['super_admin','support']));
drop policy if exists "profiles_update_own" on public.ap_user_profiles;
create policy "profiles_update_own" on public.ap_user_profiles for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "memberships_read_related" on public.ap_agency_memberships;
create policy "memberships_read_related" on public.ap_agency_memberships for select to authenticated
using (user_id = auth.uid() or ap_private.has_agency_role(agency_id,array['owner','admin']) or ap_private.is_staff(null));

drop policy if exists "memberships_manage_by_owner" on public.ap_agency_memberships;
create policy "memberships_manage_by_owner" on public.ap_agency_memberships for all to authenticated
using (ap_private.has_agency_role(agency_id,array['owner']) or ap_private.is_staff(array['super_admin']))
with check (
  (ap_private.has_agency_role(agency_id,array['owner']) and role <> 'owner')
  or ap_private.is_staff(array['super_admin'])
);

drop policy if exists "staff_read_own" on public.ap_staff_roles;
create policy "staff_read_own" on public.ap_staff_roles for select to authenticated using (user_id = auth.uid());

drop policy if exists "audit_read_staff" on public.ap_security_audit;
create policy "audit_read_staff" on public.ap_security_audit for select to authenticated
using (ap_private.is_staff(array['super_admin','moderator','verification_reviewer','support','finance']));

revoke all on public.ap_user_profiles, public.ap_agency_memberships, public.ap_staff_roles, public.ap_security_audit from anon;
grant select, update on public.ap_user_profiles to authenticated;
grant select, insert, update, delete on public.ap_agency_memberships to authenticated;
grant select on public.ap_staff_roles, public.ap_security_audit to authenticated;

create or replace function public.ap_create_user_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.ap_user_profiles(user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name',''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ap_on_auth_user_created on auth.users;
create trigger ap_on_auth_user_created after insert on auth.users
for each row execute procedure public.ap_create_user_profile();

commit;

-- Bootstrap the first platform administrator manually in the SQL Editor only.
-- Replace the email and run after that user has confirmed their account:
-- insert into public.ap_staff_roles(user_id, role)
-- select id, 'super_admin' from auth.users where email = 'OWNER_EMAIL_HERE';
