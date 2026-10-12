begin;

create table if not exists public.ap_agency_invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.ap_agencies(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','editor','analyst','billing')),
  status text not null default 'pending' check (status in ('pending','accepted','cancelled','expired')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ap_pending_invitation_unique
  on public.ap_agency_invitations(agency_id, lower(email)) where status='pending';
alter table public.ap_agency_invitations enable row level security;
create policy "invitation_related_read" on public.ap_agency_invitations for select to authenticated
using (lower(email)=lower(coalesce(auth.jwt()->>'email','')) or ap_private.has_agency_role(agency_id,array['owner','admin']) or ap_private.is_staff(array['super_admin','support']));
grant select on public.ap_agency_invitations to authenticated;

create or replace function public.ap_invite_agency_member(target_agency uuid, invite_email text, invite_role text)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation_id uuid;
begin
  if not ap_private.has_agency_role(target_agency,array['owner']) then raise exception 'Agency owner access required'; end if;
  if invite_role not in ('admin','editor','analyst','billing') then raise exception 'Invalid team role'; end if;
  if trim(invite_email) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'A valid email is required'; end if;
  insert into public.ap_agency_invitations(agency_id,email,role,invited_by)
  values(target_agency,lower(trim(invite_email)),invite_role,auth.uid()) returning id into invitation_id;
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
  values(auth.uid(),target_agency,'team.invitation_created','agency_invitation',invitation_id::text,jsonb_build_object('role',invite_role));
  return invitation_id;
end; $$;

create or replace function public.ap_accept_agency_invitation(target_invitation uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.ap_agency_invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into inv from public.ap_agency_invitations where id=target_invitation for update;
  if inv.id is null or inv.status<>'pending' or inv.expires_at<=now() then raise exception 'Invitation is unavailable or expired'; end if;
  if lower(inv.email)<>lower(coalesce(auth.jwt()->>'email','')) then raise exception 'Invitation belongs to another email address'; end if;
  insert into public.ap_agency_memberships(agency_id,user_id,role,status,invited_by)
  values(inv.agency_id,auth.uid(),inv.role,'active',inv.invited_by)
  on conflict(agency_id,user_id) do update set role=excluded.role,status='active',updated_at=now();
  update public.ap_agency_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now(),updated_at=now() where id=inv.id;
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id)
  values(auth.uid(),inv.agency_id,'team.invitation_accepted','agency_invitation',inv.id::text);
  return inv.agency_id;
end; $$;

create or replace function public.ap_cancel_agency_invitation(target_agency uuid,target_invitation uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not ap_private.has_agency_role(target_agency,array['owner']) then raise exception 'Agency owner access required'; end if;
  update public.ap_agency_invitations set status='cancelled',updated_at=now() where id=target_invitation and agency_id=target_agency and status='pending';
end; $$;

create or replace function public.ap_manage_agency_member(target_agency uuid,target_membership uuid,next_role text,next_status text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not ap_private.has_agency_role(target_agency,array['owner']) then raise exception 'Agency owner access required'; end if;
  if next_role not in ('admin','editor','analyst','billing') or next_status not in ('active','suspended','revoked') then raise exception 'Invalid role or status'; end if;
  update public.ap_agency_memberships set role=next_role,status=next_status,updated_at=now() where id=target_membership and agency_id=target_agency and role<>'owner';
end; $$;

create or replace function public.ap_agency_team(target_agency uuid)
returns table(id uuid,email text,display_name text,role text,status text,joined_at timestamptz)
language sql stable security definer set search_path='' as $$
  select m.id,coalesce(u.email,''),coalesce(p.display_name,''),m.role,m.status,m.created_at
  from public.ap_agency_memberships m join auth.users u on u.id=m.user_id
  left join public.ap_user_profiles p on p.user_id=m.user_id
  where m.agency_id=target_agency and (ap_private.has_agency_role(target_agency,array['owner','admin']) or ap_private.is_staff(array['super_admin','support']));
$$;

revoke all on function public.ap_invite_agency_member(uuid,text,text),public.ap_accept_agency_invitation(uuid),public.ap_cancel_agency_invitation(uuid,uuid),public.ap_manage_agency_member(uuid,uuid,text,text),public.ap_agency_team(uuid) from public;
grant execute on function public.ap_invite_agency_member(uuid,text,text),public.ap_accept_agency_invitation(uuid),public.ap_cancel_agency_invitation(uuid,uuid),public.ap_manage_agency_member(uuid,uuid,text,text),public.ap_agency_team(uuid) to authenticated;

commit;
