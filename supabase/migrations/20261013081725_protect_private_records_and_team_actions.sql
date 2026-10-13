-- AP Security 03 — Protect Private Records and Team Actions
begin;

revoke all on public.ap_agencies from public, anon, authenticated;
grant select, update on public.ap_agencies to authenticated;
drop policy if exists published_agencies_public_read on public.ap_agencies;

revoke all on public.ap_reviews from public, anon, authenticated;
grant select on public.ap_reviews to authenticated;
drop policy if exists published_reviews_public_read on public.ap_reviews;

revoke all on public.ap_agency_memberships from public, anon, authenticated;
grant select on public.ap_agency_memberships to authenticated;
drop policy if exists memberships_manage_by_owner on public.ap_agency_memberships;

revoke all on public.ap_support_messages from public, anon, authenticated;
grant select, insert on public.ap_support_messages to authenticated;
drop policy if exists support_message_participant_insert on public.ap_support_messages;
create policy support_message_participant_insert
on public.ap_support_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.ap_support_tickets t
    where t.id = ticket_id
      and (
        (sender_type = 'user' and not is_internal and t.user_id = auth.uid())
        or (sender_type = 'support'
            and ap_private.is_staff(array['super_admin','support']))
      )
  )
);

-- These existing views deliberately expose only curated public columns.
-- Retain their owner-backed access so private base-table RLS remains restrictive.
revoke all on public.ap_public_agencies,
  public.ap_public_platform_reviews, public.ap_platform_review_summary
from public, anon, authenticated;
grant select on public.ap_public_agencies,
  public.ap_public_platform_reviews, public.ap_platform_review_summary
to anon, authenticated;

create or replace function public.ap_accept_agency_invitation(target_invitation uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.ap_agency_invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into inv from public.ap_agency_invitations
    where id=target_invitation for update;
  if inv.id is null or inv.status<>'pending' or inv.expires_at<=now() then
    raise exception 'Invitation is unavailable or expired';
  end if;
  if lower(inv.email)<>lower(coalesce(auth.jwt()->>'email','')) then
    raise exception 'Invitation belongs to another email address';
  end if;
  insert into public.ap_agency_memberships as existing
    (agency_id,user_id,role,status,invited_by)
  values(inv.agency_id,auth.uid(),inv.role,'active',inv.invited_by)
  on conflict(agency_id,user_id) do update
    set role=excluded.role,status='active',updated_at=now()
    where existing.role<>'owner';
  if not found then
    raise exception 'An invitation cannot replace agency ownership';
  end if;
  update public.ap_agency_invitations
    set status='accepted',accepted_by=auth.uid(),accepted_at=now(),updated_at=now()
    where id=inv.id;
  insert into public.ap_security_audit
    (actor_user_id,agency_id,action,target_type,target_id)
  values(auth.uid(),inv.agency_id,'team.invitation_accepted','agency_invitation',inv.id::text);
  return inv.agency_id;
end; $$;

revoke all on function public.ap_accept_agency_invitation(uuid) from public, anon;
grant execute on function public.ap_accept_agency_invitation(uuid) to authenticated;

commit;

-- AP Security 04 — Confirm Installed Access Rules (read-only)
select
  not exists (select 1 from pg_policies where schemaname='public'
    and tablename='ap_agencies' and policyname='published_agencies_public_read')
    as private_agencies_protected,
  not exists (select 1 from pg_policies where schemaname='public'
    and tablename='ap_reviews' and policyname='published_reviews_public_read')
    as private_reviews_protected,
  not has_table_privilege('authenticated','public.ap_agency_memberships','DELETE')
    as direct_member_deletion_blocked,
  not has_table_privilege('authenticated','public.ap_agency_memberships','UPDATE')
    as direct_member_changes_blocked,
  has_table_privilege('anon','public.ap_public_agencies','SELECT')
    as public_directory_readable,
  (select count(*) from public.ap_agencies where published=true)
    as published_agencies;
