begin;

alter table public.ap_agencies
  add column if not exists tagline text,
  add column if not exists website_url text,
  add column if not exists city text,
  add column if not exists services text[] not null default '{}',
  add column if not exists creator_niches text[] not null default '{}',
  add column if not exists regions_served text[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now();

drop policy if exists "agencies_read_related" on public.ap_agencies;
create policy "agencies_read_related" on public.ap_agencies for select to authenticated
using (
  ap_private.has_agency_role(id, null)
  or ap_private.is_staff(null)
);

drop policy if exists "agencies_update_draft" on public.ap_agencies;
create policy "agencies_update_draft" on public.ap_agencies for update to authenticated
using (
  ap_private.has_agency_role(id, array['owner','admin','editor'])
  and publication_status in ('draft','changes_requested')
)
with check (
  ap_private.has_agency_role(id, array['owner','admin','editor'])
  and publication_status in ('draft','changes_requested')
  and published = false
);

grant select, update on public.ap_agencies to authenticated;

create or replace function public.ap_create_agency_draft(agency_name text, agency_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_agency_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(agency_name)) < 2 then raise exception 'Agency name is required'; end if;
  if agency_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'Invalid agency slug'; end if;

  insert into public.ap_agencies(name, slug, status, published, publication_status)
  values (trim(agency_name), agency_slug, 'pending', false, 'draft')
  returning id into new_agency_id;

  insert into public.ap_agency_memberships(agency_id, user_id, role, status)
  values (new_agency_id, auth.uid(), 'owner', 'active');

  insert into public.ap_security_audit(actor_user_id, agency_id, action, target_type, target_id)
  values (auth.uid(), new_agency_id, 'agency.draft_created', 'agency', new_agency_id::text);
  return new_agency_id;
end;
$$;

create or replace function public.ap_submit_agency_for_review(target_agency uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare agency_record public.ap_agencies%rowtype;
begin
  if not ap_private.has_agency_role(target_agency, array['owner','admin']) then
    raise exception 'Agency owner or administrator access required';
  end if;
  select * into agency_record from public.ap_agencies where id = target_agency for update;
  if agency_record.publication_status not in ('draft','changes_requested') then raise exception 'Profile cannot be submitted in its current state'; end if;
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

create or replace function public.ap_review_agency_submission(target_agency uuid, decision text, reviewer_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not ap_private.is_staff(array['super_admin','moderator']) then raise exception 'Moderator access required'; end if;
  if decision not in ('approve','request_changes','reject') then raise exception 'Invalid moderation decision'; end if;
  if length(trim(coalesce(reviewer_note,''))) < 10 then raise exception 'A meaningful reviewer note is required'; end if;

  update public.ap_agencies set
    publication_status = case decision when 'approve' then 'approved' when 'request_changes' then 'changes_requested' else 'archived' end,
    status = case decision when 'approve' then 'approved' when 'reject' then 'rejected' else status end,
    approved_at = case when decision='approve' then now() else approved_at end,
    moderation_note = reviewer_note,
    updated_at = now()
  where id=target_agency and publication_status='submitted';
  if not found then raise exception 'No submitted profile was found'; end if;

  update public.ap_moderation_cases set
    status = case decision when 'approve' then 'approved' when 'request_changes' then 'changes_requested' else 'rejected' end,
    assigned_to=auth.uid(), resolution_summary=reviewer_note, resolved_at=now(), updated_at=now()
  where agency_id=target_agency and case_type='profile' and status in ('open','in_review');
  insert into public.ap_security_audit(actor_user_id, agency_id, action, target_type, target_id, metadata)
  values(auth.uid(),target_agency,'agency.moderation_decision','agency',target_agency::text,jsonb_build_object('decision',decision));
end;
$$;

create or replace function public.ap_publish_agency(target_agency uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not ap_private.is_staff(array['super_admin','moderator']) then raise exception 'Moderator access required'; end if;
  update public.ap_agencies set publication_status='published', published=true, published_at=now(), updated_at=now()
  where id=target_agency and publication_status='approved' and status='approved' and approved_at is not null;
  if not found then raise exception 'Only an approved profile can be published'; end if;
  insert into public.ap_security_audit(actor_user_id, agency_id, action, target_type, target_id)
  values(auth.uid(),target_agency,'agency.published','agency',target_agency::text);
end;
$$;

revoke all on function public.ap_create_agency_draft(text,text) from public;
revoke all on function public.ap_submit_agency_for_review(uuid) from public;
revoke all on function public.ap_review_agency_submission(uuid,text,text) from public;
revoke all on function public.ap_publish_agency(uuid) from public;
grant execute on function public.ap_create_agency_draft(text,text) to authenticated;
grant execute on function public.ap_submit_agency_for_review(uuid) to authenticated;
grant execute on function public.ap_review_agency_submission(uuid,text,text) to authenticated;
grant execute on function public.ap_publish_agency(uuid) to authenticated;

commit;
