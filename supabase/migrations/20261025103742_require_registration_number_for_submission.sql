-- AP Fix 03 - Require a Verified Registration Number Before Agency Submission
-- Save in supabase/migrations/. Run once after Step 01.
-- Changes one function and its EXECUTE grants; does not modify existing records.
begin;

create or replace function public.ap_submit_agency_for_review(target_agency uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare agency_record public.ap_agencies%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not ap_private.has_agency_role(target_agency, array['owner','admin']) then
    raise exception 'Agency owner or administrator access required';
  end if;
  select * into agency_record from public.ap_agencies where id = target_agency for update;
  if not found then raise exception 'Agency not found'; end if;
  if agency_record.publication_status not in ('draft','changes_requested') then raise exception 'Profile cannot be submitted in its current state'; end if;
  -- A draft must exist before the trusted server can bind its number.
  -- Enforce the requirement at submission, including direct Data API/RPC calls.
  -- Never use user-editable signup metadata as evidence.
  if not exists (
    select 1 from public.ap_agency_registration_numbers r
    join public.ap_agency_memberships m
      on m.agency_id=r.agency_id and m.user_id=r.owner_user_id
    where r.agency_id=target_agency and r.bound_at is not null
      and r.verified_at is not null and r.delivery_status='sent'
      and m.role='owner' and m.status='active'
  ) and not exists (
    -- Curated listings use a separate, owner-reviewed claim process.
    -- Only a completed claim belonging to a current active owner qualifies.
    select 1 from public.ap_agency_claims c
    join public.ap_agency_memberships m
      on m.agency_id=c.agency_id and m.user_id=c.claimant_user_id
    where c.agency_id=target_agency and c.status='approved'
      and c.reviewed_by is not null and c.reviewed_at is not null
      and c.profile_confirmed and c.reviewed_snapshot is not null
      and c.reviewer_checks='{"identity":true,"authority":true,"contact":true,"information":true}'::jsonb
      and m.role='owner' and m.status='active'
  ) then
    raise exception 'Verify and assign your Avera Privé registration number before submitting this agency. Contact support if you need help completing registration.';
  end if;

  if length(trim(coalesce(agency_record.name,''))) < 2
    or length(trim(coalesce(agency_record.about,''))) < 80
    or agency_record.country is null
    or cardinality(agency_record.services) = 0 then
      raise exception 'Complete the agency name, country, about section, and at least one service';
  end if;
  update public.ap_agencies set publication_status='submitted', submitted_at=now(), moderation_note=null, updated_at=now()
  where id=target_agency;
  insert into public.ap_moderation_cases(agency_id, case_type, status, opened_by)
  values(target_agency,'profile','open',auth.uid());
  insert into public.ap_security_audit(actor_user_id, agency_id, action, target_type, target_id)
  values(auth.uid(),target_agency,'agency.submitted','agency',target_agency::text);
end;
$$;

revoke all on function public.ap_submit_agency_for_review(uuid) from public,anon,authenticated;
grant execute on function public.ap_submit_agency_for_review(uuid) to authenticated;

commit;
