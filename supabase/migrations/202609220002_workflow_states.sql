begin;

-- Adds secure publication state without changing independent verification state.
alter table public.ap_agencies
  add column if not exists publication_status text not null default 'draft',
  add column if not exists submitted_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists moderation_note text;

do $$ begin
  alter table public.ap_agencies add constraint ap_agencies_publication_status_check
    check (publication_status in ('draft','submitted','changes_requested','approved','published','suspended','archived'));
exception when duplicate_object then null; end $$;

create table if not exists public.ap_moderation_cases (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.ap_agencies(id) on delete cascade,
  case_type text not null check (case_type in ('profile','review','verification','dispute','fraud')),
  status text not null default 'open' check (status in ('open','in_review','changes_requested','approved','rejected','resolved','closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  opened_by uuid references auth.users(id) on delete set null,
  resolution_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.ap_moderation_cases enable row level security;
drop policy if exists "moderation_staff_only" on public.ap_moderation_cases;
create policy "moderation_staff_only" on public.ap_moderation_cases for all to authenticated
using (ap_private.is_staff(array['super_admin','moderator','verification_reviewer']))
with check (ap_private.is_staff(array['super_admin','moderator','verification_reviewer']));
revoke all on public.ap_moderation_cases from anon;
grant select, insert, update on public.ap_moderation_cases to authenticated;

commit;
