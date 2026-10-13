begin;

alter table public.ap_agencies
  add column if not exists demo_profile boolean not null default false,
  add column if not exists category text,
  add column if not exists founded_year integer,
  add column if not exists employee_count_range text,
  add column if not exists languages text[] not null default '{}',
  add column if not exists ideal_client text,
  add column if not exists minimum_requirements text,
  add column if not exists accepting_inquiries boolean not null default true,
  add column if not exists demo_reputation_score numeric(2,1),
  add column if not exists demo_review_count integer not null default 0;

do $$ begin
  alter table public.ap_agencies add constraint ap_demo_score_range check (demo_reputation_score is null or demo_reputation_score between 1 and 5);
exception when duplicate_object then null; end $$;

-- Fictional agency and rating inserts removed from the production migration chain.

-- Recreate the projection because this migration adds columns before existing columns.
-- No CASCADE: unexpected dependencies must stop the migration rather than be removed.
drop view public.ap_public_agencies;
create view public.ap_public_agencies as
select a.id,a.name,a.slug,a.tagline,a.positioning_statement,a.about,a.country,a.city,a.website_url,a.logo_url,a.cover_image_url,
       a.services,a.creator_niches,a.regions_served,a.social_links,a.published_at,a.category,a.founded_year,a.employee_count_range,
       a.languages,a.ideal_client,a.minimum_requirements,a.accepting_inquiries,a.demo_profile,a.demo_reputation_score,a.demo_review_count,
       case when a.demo_profile then false else exists(select 1 from public.ap_verifications v where v.agency_id=a.id and v.status='approved') end as verified,
       case when not a.demo_profile and exists(select 1 from public.ap_verifications v where v.agency_id=a.id and v.status='approved') then 'verified' else 'unverified' end as verification_status,
       coalesce((select round(avg(r.rating)::numeric,2) from public.ap_reviews r where r.agency_id=a.id and r.status='published'),0) as average_rating,
       (select count(*) from public.ap_reviews r where r.agency_id=a.id and r.status='published') as review_count
from public.ap_agencies a where a.published=true and a.publication_status='published' and a.status='approved';

grant select on public.ap_public_agencies to anon,authenticated;

create or replace function public.ap_submit_verification_request(target_agency uuid, private_evidence jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare request_id uuid;
begin
  if exists(select 1 from public.ap_agencies where id=target_agency and demo_profile) then raise exception 'Demonstration profiles cannot request verification'; end if;
  if not ap_private.has_agency_role(target_agency,array['owner','admin']) then raise exception 'Agency owner or administrator access required'; end if;
  if jsonb_typeof(coalesce(private_evidence,'{}'::jsonb))<>'object' or private_evidence='{}'::jsonb then raise exception 'Verification evidence is required'; end if;
  insert into public.ap_verifications(agency_id,status,evidence_private,submitted_by,submitted_at) values(target_agency,'pending',private_evidence,auth.uid(),now()) returning id into request_id;
  insert into public.ap_moderation_cases(agency_id,case_type,status,opened_by) values(target_agency,'verification','open',auth.uid());
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id) values(auth.uid(),target_agency,'verification.submitted','verification',request_id::text);
  return request_id;
end; $$;

create or replace function public.ap_submit_inquiry(target_agency uuid,visitor_session text,contact_name text,contact_email text,inquiry_message text,event_source text,contact_consent boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare inquiry_id uuid; eligible boolean;
begin
  select published and accepting_inquiries and not demo_profile into eligible from public.ap_agencies where id=target_agency;
  if not coalesce(eligible,false) then raise exception 'Agency is not accepting public inquiries'; end if;
  if visitor_session !~ '^[a-zA-Z0-9_-]{16,80}$' then raise exception 'Invalid session'; end if;
  if not contact_consent then raise exception 'Contact consent is required'; end if;
  if length(trim(contact_name))<2 or length(trim(contact_name))>100 then raise exception 'Invalid name'; end if;
  if contact_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'Invalid email'; end if;
  if length(trim(inquiry_message))<20 or length(trim(inquiry_message))>3000 then raise exception 'Inquiry must be between 20 and 3000 characters'; end if;
  if exists(select 1 from public.ap_inquiries where session_id=visitor_session and agency_id=target_agency and created_at>now()-interval '15 minutes') then raise exception 'Please wait before sending another inquiry'; end if;
  insert into public.ap_inquiries(agency_id,sender_name,sender_email,message,session_id,source,consent_to_contact)
  values(target_agency,trim(contact_name),lower(trim(contact_email)),trim(inquiry_message),visitor_session,case when event_source in ('organic','sponsored','direct','search') then event_source else 'organic' end,true) returning id into inquiry_id;
  insert into public.ap_marketplace_events(agency_id,event_type,session_id,page_path,source,consent_state) values(target_agency,'inquiry_submitted',visitor_session,'/agency-profile.html','organic','essential');
  return inquiry_id;
end; $$;

create or replace function public.ap_record_marketplace_event(target_agency uuid,event_name text,visitor_session text,event_page text,event_source text default 'organic',analytics_consent boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare eligible boolean;
begin
  select published and not demo_profile into eligible from public.ap_agencies where id=target_agency;
  if not coalesce(eligible,false) then return; end if;
  if event_name not in ('directory_impression','profile_view','contact_open','website_click') then raise exception 'Invalid public event'; end if;
  if visitor_session !~ '^[a-zA-Z0-9_-]{16,80}$' then raise exception 'Invalid session'; end if;
  if exists(select 1 from public.ap_marketplace_events where agency_id=target_agency and event_type=event_name and session_id=visitor_session and occurred_at>now()-interval '30 minutes') then return; end if;
  insert into public.ap_marketplace_events(agency_id,event_type,session_id,page_path,source,consent_state)
  values(target_agency,event_name,visitor_session,left(coalesce(event_page,'/'),200),case when event_source in ('organic','sponsored','direct','search') then event_source else 'organic' end,case when analytics_consent then 'analytics' else 'essential' end);
end; $$;

commit;
