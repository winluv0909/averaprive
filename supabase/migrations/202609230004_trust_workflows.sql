begin;

-- Review, verification, reporting, dispute, and fraud workflows.
-- This migration never publishes an agency and never derives trust from plan or payment.

alter table public.ap_verifications
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.ap_reviews
  add column if not exists updated_at timestamptz not null default now();

alter table public.ap_reports
  add column if not exists category text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.ap_fraud_flags
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.ap_reports add constraint ap_reports_category_check
    check (category is null or category in ('identity','misrepresentation','review','conduct','privacy','other'));
exception when duplicate_object then null; end $$;

create unique index if not exists ap_one_open_verification_request
  on public.ap_verifications(agency_id)
  where status in ('pending','needs_information');

create table if not exists public.ap_review_responses (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.ap_reviews(id) on delete cascade,
  agency_id uuid not null references public.ap_agencies(id) on delete cascade,
  response_body text not null check (length(trim(response_body)) between 10 and 3000),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','published','rejected','hidden')),
  moderator_id uuid references auth.users(id) on delete set null,
  moderation_reason text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ap_published_response_needs_moderation check (
    status <> 'published' or
    (moderator_id is not null and published_at is not null and nullif(trim(moderation_reason),'') is not null)
  )
);

create table if not exists public.ap_disputes (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.ap_agencies(id) on delete cascade,
  review_id uuid references public.ap_reviews(id) on delete cascade,
  report_id uuid references public.ap_reports(id) on delete set null,
  opened_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check (length(trim(reason)) between 20 and 5000),
  evidence_private jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','investigating','upheld','denied','withdrawn')),
  assigned_to uuid references auth.users(id) on delete set null,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ap_dispute_resolution_recorded check (
    status not in ('upheld','denied') or
    (assigned_to is not null and resolved_at is not null and nullif(trim(resolution),'') is not null)
  )
);

create unique index if not exists ap_one_open_dispute_per_review
  on public.ap_disputes(agency_id, review_id)
  where review_id is not null and status in ('open','investigating');

alter table public.ap_review_responses enable row level security;
alter table public.ap_disputes enable row level security;

drop policy if exists "verification_related_read" on public.ap_verifications;
create policy "verification_related_read" on public.ap_verifications for select to authenticated
using (
  ap_private.has_agency_role(agency_id, array['owner','admin'])
  or ap_private.is_staff(array['super_admin','verification_reviewer'])
);

drop policy if exists "reviews_related_read" on public.ap_reviews;
create policy "reviews_related_read" on public.ap_reviews for select to authenticated
using (
  reviewer_id = auth.uid()
  or ap_private.has_agency_role(agency_id, array['owner','admin'])
  or ap_private.is_staff(array['super_admin','moderator'])
);

drop policy if exists "reports_related_read" on public.ap_reports;
create policy "reports_related_read" on public.ap_reports for select to authenticated
using (
  reporter_id = auth.uid()
  or ap_private.has_agency_role(agency_id, array['owner','admin'])
  or ap_private.is_staff(array['super_admin','moderator','support'])
);

drop policy if exists "fraud_staff_only" on public.ap_fraud_flags;
create policy "fraud_staff_only" on public.ap_fraud_flags for select to authenticated
using (ap_private.is_staff(array['super_admin','moderator','verification_reviewer']));

drop policy if exists "review_responses_related_read" on public.ap_review_responses;
create policy "review_responses_related_read" on public.ap_review_responses for select to authenticated
using (
  ap_private.has_agency_role(agency_id, array['owner','admin'])
  or ap_private.is_staff(array['super_admin','moderator'])
);

drop policy if exists "disputes_related_read" on public.ap_disputes;
create policy "disputes_related_read" on public.ap_disputes for select to authenticated
using (
  opened_by = auth.uid()
  or ap_private.has_agency_role(agency_id, array['owner','admin'])
  or ap_private.is_staff(array['super_admin','moderator','support'])
);

revoke all on public.ap_verifications, public.ap_reviews, public.ap_reports,
  public.ap_fraud_flags, public.ap_review_responses, public.ap_disputes from anon, authenticated;
grant select on public.ap_verifications, public.ap_reviews, public.ap_reports,
  public.ap_fraud_flags, public.ap_review_responses, public.ap_disputes to authenticated;

create or replace function public.ap_submit_verification_request(target_agency uuid, private_evidence jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare request_id uuid;
begin
  if not ap_private.has_agency_role(target_agency, array['owner','admin']) then
    raise exception 'Agency owner or administrator access required';
  end if;
  if jsonb_typeof(coalesce(private_evidence, '{}'::jsonb)) <> 'object'
     or private_evidence = '{}'::jsonb then
    raise exception 'Verification evidence is required';
  end if;

  insert into public.ap_verifications(agency_id,status,evidence_private,submitted_by,submitted_at)
  values(target_agency,'pending',private_evidence,auth.uid(),now())
  returning id into request_id;

  insert into public.ap_moderation_cases(agency_id,case_type,status,opened_by)
  values(target_agency,'verification','open',auth.uid());
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id)
  values(auth.uid(),target_agency,'verification.submitted','verification',request_id::text);
  return request_id;
end;
$$;

create or replace function public.ap_review_verification_request(
  verification_id uuid, decision text, reviewer_reason text, completed_checks jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
declare target_agency uuid;
begin
  if not ap_private.is_staff(array['super_admin','verification_reviewer']) then
    raise exception 'Verification reviewer access required';
  end if;
  if decision not in ('needs_information','approve','reject','revoke') then
    raise exception 'Invalid verification decision';
  end if;
  if length(trim(coalesce(reviewer_reason,''))) < 20 then
    raise exception 'A meaningful evidence-based reason is required';
  end if;

  update public.ap_verifications set
    status = case decision when 'approve' then 'approved' when 'reject' then 'rejected' when 'revoke' then 'revoked' else 'needs_information' end,
    evidence_private = case when decision='approve' then evidence_private || completed_checks else evidence_private end,
    decision_reason = reviewer_reason,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id=verification_id
    and (status in ('pending','needs_information') or (decision='revoke' and status='approved'))
  returning agency_id into target_agency;
  if target_agency is null then raise exception 'Eligible verification request not found'; end if;

  update public.ap_moderation_cases set
    status = case decision when 'approve' then 'approved' when 'reject' then 'rejected' when 'needs_information' then 'changes_requested' else 'resolved' end,
    assigned_to=auth.uid(), resolution_summary=reviewer_reason,
    resolved_at=case when decision='needs_information' then null else now() end, updated_at=now()
  where agency_id=target_agency and case_type='verification' and status in ('open','in_review','changes_requested');
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
  values(auth.uid(),target_agency,'verification.decision','verification',verification_id::text,jsonb_build_object('decision',decision));
end;
$$;

create or replace function public.ap_submit_review(target_agency uuid, review_rating smallint, review_body text, private_evidence jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare review_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if ap_private.has_agency_role(target_agency,null) then raise exception 'Agency staff cannot review their own agency'; end if;
  insert into public.ap_reviews(agency_id,reviewer_id,rating,body,relationship_evidence_private,status)
  values(target_agency,auth.uid(),review_rating,trim(review_body),coalesce(private_evidence,'{}'::jsonb),'pending')
  returning id into review_id;
  insert into public.ap_moderation_cases(agency_id,case_type,status,opened_by)
  values(target_agency,'review','open',auth.uid());
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id)
  values(auth.uid(),target_agency,'review.submitted','review',review_id::text);
  return review_id;
end;
$$;

create or replace function public.ap_moderate_review(target_review uuid, decision text, reviewer_reason text, relationship_verified boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare target_agency uuid;
begin
  if not ap_private.is_staff(array['super_admin','moderator']) then raise exception 'Moderator access required'; end if;
  if decision not in ('publish','reject','hide') then raise exception 'Invalid review decision'; end if;
  if length(trim(coalesce(reviewer_reason,''))) < 20 then raise exception 'A meaningful moderation reason is required'; end if;
  if decision='publish' and not relationship_verified then raise exception 'Relationship evidence must be verified before publication'; end if;

  update public.ap_reviews set
    status=case decision when 'publish' then 'published' when 'reject' then 'rejected' else 'hidden' end,
    relationship_checked=case when decision='publish' then true else relationship_checked end,
    moderator_id=auth.uid(), moderation_reason=reviewer_reason,
    published_at=case when decision='publish' then now() else published_at end, updated_at=now()
  where id=target_review and status in ('pending','published') returning agency_id into target_agency;
  if target_agency is null then raise exception 'Eligible review not found'; end if;
  update public.ap_moderation_cases set status=case when decision='publish' then 'approved' else 'rejected' end,
    assigned_to=auth.uid(),resolution_summary=reviewer_reason,resolved_at=now(),updated_at=now()
  where agency_id=target_agency and case_type='review' and status in ('open','in_review');
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
  values(auth.uid(),target_agency,'review.moderation_decision','review',target_review::text,jsonb_build_object('decision',decision));
end;
$$;

create or replace function public.ap_submit_agency_response(target_review uuid, response_text text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_agency uuid; response_id uuid;
begin
  select agency_id into target_agency from public.ap_reviews where id=target_review and status='published';
  if target_agency is null then raise exception 'Published review not found'; end if;
  if not ap_private.has_agency_role(target_agency,array['owner','admin']) then raise exception 'Agency owner or administrator access required'; end if;
  insert into public.ap_review_responses(review_id,agency_id,response_body,submitted_by)
  values(target_review,target_agency,trim(response_text),auth.uid()) returning id into response_id;
  insert into public.ap_moderation_cases(agency_id,case_type,status,opened_by,resolution_summary)
  values(target_agency,'review','open',auth.uid(),'Agency response awaiting moderation');
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id)
  values(auth.uid(),target_agency,'review_response.submitted','review_response',response_id::text);
  return response_id;
end;
$$;

create or replace function public.ap_submit_report(target_agency uuid, target_review uuid, report_category text, report_reason text, private_evidence jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare report_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.ap_reports(agency_id,review_id,reporter_id,category,reason,evidence_private)
  values(target_agency,target_review,auth.uid(),report_category,trim(report_reason),coalesce(private_evidence,'{}'::jsonb))
  returning id into report_id;
  insert into public.ap_moderation_cases(agency_id,case_type,status,opened_by)
  values(target_agency,'dispute','open',auth.uid());
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id)
  values(auth.uid(),target_agency,'report.submitted','report',report_id::text);
  return report_id;
end;
$$;

create or replace function public.ap_open_dispute(target_review uuid, dispute_reason text, private_evidence jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_agency uuid; dispute_id uuid;
begin
  select agency_id into target_agency from public.ap_reviews where id=target_review;
  if target_agency is null then raise exception 'Review not found'; end if;
  if not ap_private.has_agency_role(target_agency,array['owner','admin']) then raise exception 'Agency owner or administrator access required'; end if;
  insert into public.ap_disputes(agency_id,review_id,opened_by,reason,evidence_private)
  values(target_agency,target_review,auth.uid(),trim(dispute_reason),coalesce(private_evidence,'{}'::jsonb))
  returning id into dispute_id;
  insert into public.ap_moderation_cases(agency_id,case_type,status,opened_by)
  values(target_agency,'dispute','open',auth.uid());
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id)
  values(auth.uid(),target_agency,'dispute.opened','dispute',dispute_id::text);
  return dispute_id;
end;
$$;

revoke all on function public.ap_submit_verification_request(uuid,jsonb) from public;
revoke all on function public.ap_review_verification_request(uuid,text,text,jsonb) from public;
revoke all on function public.ap_submit_review(uuid,smallint,text,jsonb) from public;
revoke all on function public.ap_moderate_review(uuid,text,text,boolean) from public;
revoke all on function public.ap_submit_agency_response(uuid,text) from public;
revoke all on function public.ap_submit_report(uuid,uuid,text,text,jsonb) from public;
revoke all on function public.ap_open_dispute(uuid,text,jsonb) from public;
grant execute on function public.ap_submit_verification_request(uuid,jsonb) to authenticated;
grant execute on function public.ap_review_verification_request(uuid,text,text,jsonb) to authenticated;
grant execute on function public.ap_submit_review(uuid,smallint,text,jsonb) to authenticated;
grant execute on function public.ap_moderate_review(uuid,text,text,boolean) to authenticated;
grant execute on function public.ap_submit_agency_response(uuid,text) to authenticated;
grant execute on function public.ap_submit_report(uuid,uuid,text,text,jsonb) to authenticated;
grant execute on function public.ap_open_dispute(uuid,text,jsonb) to authenticated;

commit;
