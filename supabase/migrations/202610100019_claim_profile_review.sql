begin;

alter table public.ap_agencies add column if not exists directory_information jsonb not null default '{}'::jsonb;
alter table public.ap_agency_claims
 add column if not exists representative_name text,
 add column if not exists representative_role text,
 add column if not exists business_contact text,
 add column if not exists profile_confirmed boolean not null default false,
 add column if not exists requested_corrections text,
 add column if not exists profile_snapshot jsonb,
 add column if not exists reviewer_checks jsonb,
 add column if not exists reviewed_snapshot jsonb;

create or replace function ap_private.claim_profile_snapshot(target_agency uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('name',a.name,'website_url',a.website_url,'about',a.about,
 'country',a.country,'city',a.city,'services',a.services,'social_links',a.social_links,
 'directory_information',a.directory_information,'tagline',a.tagline,'positioning_statement',a.positioning_statement,
 'category',a.category,'founded_year',a.founded_year,'employee_count_range',a.employee_count_range,
 'languages',a.languages,'regions_served',a.regions_served,'creator_niches',a.creator_niches,
 'ideal_client',a.ideal_client,'minimum_requirements',a.minimum_requirements)
 from public.ap_agencies a where a.id=target_agency;
$$;
revoke all on function ap_private.claim_profile_snapshot(uuid) from public,anon,authenticated;

-- Older clients cannot bypass the new profile review and representative fields.
create or replace function public.ap_request_agency_claim(target_agency uuid, ownership_evidence text)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 raise exception 'Please use the updated claim form to review the profile and provide representative details';
end; $$;

create or replace function public.ap_request_agency_claim_reviewed(
 target_agency uuid, ownership_evidence text, full_name text, job_role text,
 company_contact text, information_confirmed boolean, corrections text, expected_profile jsonb
)
returns uuid language plpgsql security definer set search_path='' as $$
declare claim_id uuid; current_profile jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in to claim a profile'; end if;
 if ap_private.is_staff(null) then raise exception 'Use a separate agency account to claim a profile'; end if;
 perform 1 from public.ap_agencies where id=target_agency and published and status='approved' and publication_status='published' and not demo_profile for update;
 if not found then raise exception 'Published agency not found'; end if;
 if exists(select 1 from public.ap_agency_memberships where agency_id=target_agency and role='owner' and status='active') then raise exception 'This profile already has an owner'; end if;
 if not coalesce(information_confirmed,false) then raise exception 'Review and confirm the profile information first'; end if;
 if length(trim(coalesce(full_name,''))) not between 2 and 160 or length(trim(coalesce(job_role,''))) not between 2 and 160 then raise exception 'Your full name and role are required'; end if;
 if coalesce(company_contact,'') !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' or length(company_contact)>254 then raise exception 'A valid business contact email is required'; end if;
 if length(trim(coalesce(ownership_evidence,''))) not between 40 and 5000 or length(coalesce(corrections,''))>5000 then raise exception 'Provide 40 to 5000 characters of evidence and at most 5000 characters of corrections'; end if;
 current_profile:=ap_private.claim_profile_snapshot(target_agency);
 if expected_profile is distinct from current_profile then raise exception 'The profile changed. Reload and review the latest information before submitting'; end if;
 insert into public.ap_agency_claims(agency_id,claimant_user_id,evidence,representative_name,representative_role,business_contact,profile_confirmed,requested_corrections,profile_snapshot)
 values(target_agency,auth.uid(),trim(ownership_evidence),trim(full_name),trim(job_role),lower(trim(company_contact)),true,nullif(trim(corrections),''),current_profile) returning id into claim_id;
 return claim_id;
end; $$;

create or replace function public.ap_review_agency_claim(target_claim uuid, decision text, review_note text)
returns void language plpgsql security definer set search_path='' as $$
declare claim public.ap_agency_claims; target_id uuid;
begin
 if not ap_private.is_staff(array['super_admin']) then raise exception 'Owner reviewer access required'; end if;
 if coalesce(decision,'') not in ('approved','rejected') or length(trim(coalesce(review_note,'')))<10 then raise exception 'Decision and review explanation required'; end if;
 select agency_id into target_id from public.ap_agency_claims where id=target_claim;
 perform 1 from public.ap_agencies where id=target_id for update;
 select * into claim from public.ap_agency_claims where id=target_claim for update;
 if not found or claim.status<>'pending' then raise exception 'Pending claim not found'; end if;
 if decision='approved' then
  if not claim.profile_confirmed or claim.profile_snapshot is null or claim.representative_name is null or claim.business_contact is null
   or claim.reviewer_checks is distinct from '{"identity":true,"authority":true,"contact":true,"information":true}'::jsonb then
   raise exception 'Representative details and all four reviewer checks are required. Legacy claims must be resubmitted using the updated form';
  end if;
  if claim.reviewed_snapshot is distinct from ap_private.claim_profile_snapshot(target_id) then raise exception 'Profile changed during review. Reload and review again'; end if;
  if exists(select 1 from public.ap_agency_memberships where agency_id=claim.agency_id and role='owner' and status='active') then raise exception 'This agency already has an owner'; end if;
  if exists(select 1 from public.ap_staff_roles where user_id=claim.claimant_user_id) then raise exception 'Staff accounts cannot own agency profiles'; end if;
  insert into public.ap_agency_memberships(agency_id,user_id,role,status) values(claim.agency_id,claim.claimant_user_id,'owner','active')
  on conflict(agency_id,user_id) do update set role='owner',status='active',updated_at=now();
 end if;
 update public.ap_agency_claims set status=decision,reviewer_note=trim(review_note),reviewed_by=auth.uid(),reviewed_at=now() where id=target_claim;
 insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id) values(auth.uid(),claim.agency_id,'claim.'||decision,'agency_claim',target_claim::text);
end; $$;

create or replace function public.ap_review_agency_claim_checked(
 target_claim uuid, decision text, review_note text, checks jsonb, expected_profile jsonb
)
returns void language plpgsql security definer set search_path='' as $$
declare target_id uuid;
begin
 if not ap_private.is_staff(array['super_admin']) then raise exception 'Owner reviewer access required'; end if;
 select agency_id into target_id from public.ap_agency_claims where id=target_claim;
 perform 1 from public.ap_agencies where id=target_id for update;
 if decision='approved' then
  if checks is distinct from '{"identity":true,"authority":true,"contact":true,"information":true}'::jsonb then raise exception 'Complete all four verification checks before approving'; end if;
  if expected_profile is distinct from ap_private.claim_profile_snapshot(target_id) then raise exception 'Profile changed. Reload and verify the latest information'; end if;
  update public.ap_agency_claims set reviewer_checks=checks,reviewed_snapshot=expected_profile where id=target_claim and status='pending';
 end if;
 perform public.ap_review_agency_claim(target_claim,decision,review_note);
end; $$;

create or replace function public.ap_correct_curated_profile(target_agency uuid, changes jsonb, expected_profile jsonb, source_url text, review_note text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not ap_private.is_staff(array['super_admin']) then raise exception 'Owner reviewer access required'; end if;
 perform 1 from public.ap_agencies where id=target_agency and not demo_profile for update;
 if not found then raise exception 'Agency not found'; end if;
 if expected_profile is distinct from ap_private.claim_profile_snapshot(target_agency) then raise exception 'Profile changed. Reload before saving corrections'; end if;
 if coalesce(jsonb_typeof(changes),'')<>'object' or length(trim(coalesce(changes->>'name',''))) not between 2 and 160
  or coalesce(changes->>'website_url','') !~ '^https://[^ /]+' or length(trim(coalesce(changes->>'about','')))<40
  or coalesce(jsonb_typeof(changes->'services'),'')<>'array' or coalesce(jsonb_typeof(changes->'directory_information'),'')<>'object'
  or coalesce(source_url,'') !~ '^https://[^ /]+' or length(trim(coalesce(review_note,'')))<10 then raise exception 'Valid profile details, official source and review explanation are required'; end if;
 if exists(select 1 from jsonb_array_elements(changes->'services') item where jsonb_typeof(item)<>'string') then raise exception 'Services must be text'; end if;
 update public.ap_agencies set name=trim(changes->>'name'),website_url=trim(changes->>'website_url'),about=trim(changes->>'about'),
 country=nullif(trim(changes->>'country'),''),city=nullif(trim(changes->>'city'),''),
 services=array(select jsonb_array_elements_text(changes->'services')),
 directory_information=directory_information || (changes->'directory_information') || jsonb_build_object('owner_reviewed_source',source_url,'owner_reviewed_at',now()),updated_at=now()
 where id=target_agency;
 insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
 values(auth.uid(),target_agency,'agency.information_corrected','agency',target_agency::text,jsonb_build_object('source',source_url,'note',trim(review_note)));
end; $$;

revoke all on function public.ap_request_agency_claim_reviewed(uuid,text,text,text,text,boolean,text,jsonb),public.ap_review_agency_claim_checked(uuid,text,text,jsonb,jsonb),public.ap_correct_curated_profile(uuid,jsonb,jsonb,text,text) from public,anon;
grant execute on function public.ap_request_agency_claim_reviewed(uuid,text,text,text,text,boolean,text,jsonb),public.ap_review_agency_claim_checked(uuid,text,text,jsonb,jsonb),public.ap_correct_curated_profile(uuid,jsonb,jsonb,text,text) to authenticated;

-- Append research details without changing existing public view columns.
create or replace view public.ap_public_agencies as
select a.id,a.name,a.slug,a.tagline,a.positioning_statement,a.about,a.country,a.city,a.website_url,a.logo_url,a.cover_image_url,
 a.services,a.creator_niches,a.regions_served,a.social_links,a.published_at,a.category,a.founded_year,a.employee_count_range,
 a.languages,a.ideal_client,a.minimum_requirements,a.accepting_inquiries,a.demo_profile,a.demo_reputation_score,a.demo_review_count,
 case when a.demo_profile then false else exists(select 1 from public.ap_verifications v where v.agency_id=a.id and v.status='approved') end as verified,
 case when not a.demo_profile and exists(select 1 from public.ap_verifications v where v.agency_id=a.id and v.status='approved') then 'verified' else 'unverified' end as verification_status,
 coalesce((select round(avg(r.rating)::numeric,2) from public.ap_reviews r where r.agency_id=a.id and r.status='published'),0) as average_rating,
 (select count(*) from public.ap_reviews r where r.agency_id=a.id and r.status='published') as review_count,
 (select er.rating from public.ap_external_ratings er where er.agency_id=a.id and er.platform='trustpilot') as external_rating,
 (select er.review_count from public.ap_external_ratings er where er.agency_id=a.id and er.platform='trustpilot') as external_review_count,
 (select er.rating_status from public.ap_external_ratings er where er.agency_id=a.id and er.platform='trustpilot') as external_rating_status,
 (select er.is_demo from public.ap_external_ratings er where er.agency_id=a.id and er.platform='trustpilot') as external_rating_is_demo,
 a.directory_information
from public.ap_agencies a where a.published=true and a.publication_status='published' and a.status='approved';
commit;
