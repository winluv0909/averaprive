begin;

create table if not exists public.ap_sponsored_placements (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.ap_agencies(id) on delete cascade,
  placement_type text not null check (placement_type in ('homepage','directory','category','country','editorial')),
  placement_key text,
  disclosure_label text not null default 'Featured / Sponsored',
  status text not null default 'scheduled' check (status in ('scheduled','active','paused','expired','cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  commercial_reference text,
  internal_notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ap_placement_valid_window check (ends_at > starts_at),
  constraint ap_placement_disclosure_required check (length(trim(disclosure_label)) >= 10)
);

create index if not exists ap_active_placement_lookup on public.ap_sponsored_placements(agency_id,status,starts_at,ends_at);
alter table public.ap_sponsored_placements enable row level security;
drop policy if exists "active_placements_public_read" on public.ap_sponsored_placements;
create policy "active_placements_public_read" on public.ap_sponsored_placements for select
using (status='active' and starts_at<=now() and ends_at>now());
drop policy if exists "placements_staff_read" on public.ap_sponsored_placements;
create policy "placements_staff_read" on public.ap_sponsored_placements for select to authenticated
using (ap_private.is_staff(array['super_admin','finance']));
revoke all on public.ap_sponsored_placements from anon, authenticated;
grant select on public.ap_sponsored_placements to anon, authenticated;

create or replace function public.ap_create_sponsored_placement(
  target_agency uuid, placement_kind text, inventory_key text, start_time timestamptz,
  end_time timestamptz, payment_reference text, staff_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare placement_id uuid; agency_public boolean;
begin
  if not ap_private.is_staff(array['super_admin','finance']) then raise exception 'Placement manager access required'; end if;
  select published into agency_public from public.ap_agencies where id=target_agency;
  if not coalesce(agency_public,false) then raise exception 'Only published agencies are eligible for sponsored placement'; end if;
  if end_time<=start_time then raise exception 'Placement end must be after its start'; end if;
  insert into public.ap_sponsored_placements(agency_id,placement_type,placement_key,starts_at,ends_at,commercial_reference,internal_notes,created_by)
  values(target_agency,placement_kind,nullif(trim(inventory_key),''),start_time,end_time,nullif(trim(payment_reference),''),nullif(trim(staff_notes),''),auth.uid()) returning id into placement_id;
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
  values(auth.uid(),target_agency,'placement.created','sponsored_placement',placement_id::text,jsonb_build_object('placement_type',placement_kind,'starts_at',start_time,'ends_at',end_time));
  return placement_id;
end; $$;

create or replace function public.ap_update_sponsored_placement_status(placement_id uuid, next_status text, decision_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare target_agency uuid;
begin
  if not ap_private.is_staff(array['super_admin','finance']) then raise exception 'Placement manager access required'; end if;
  if next_status not in ('scheduled','active','paused','expired','cancelled') then raise exception 'Invalid placement status'; end if;
  if length(trim(coalesce(decision_note,'')))<10 then raise exception 'A status-change reason is required'; end if;
  update public.ap_sponsored_placements set status=next_status,updated_by=auth.uid(),updated_at=now(),internal_notes=concat_ws(E'\n',internal_notes,trim(decision_note)) where id=placement_id returning agency_id into target_agency;
  if target_agency is null then raise exception 'Placement not found'; end if;
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
  values(auth.uid(),target_agency,'placement.status_changed','sponsored_placement',placement_id::text,jsonb_build_object('status',next_status,'reason',trim(decision_note)));
end; $$;

revoke all on function public.ap_create_sponsored_placement(uuid,text,text,timestamptz,timestamptz,text,text) from public;
revoke all on function public.ap_update_sponsored_placement_status(uuid,text,text) from public;
grant execute on function public.ap_create_sponsored_placement(uuid,text,text,timestamptz,timestamptz,text,text) to authenticated;
grant execute on function public.ap_update_sponsored_placement_status(uuid,text,text) to authenticated;

commit;
