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

insert into public.ap_agencies
  (id,name,slug,tagline,positioning_statement,about,country,city,website_url,services,creator_niches,regions_served,status,published,publication_status,approved_at,published_at,demo_profile,category,founded_year,employee_count_range,languages,ideal_client,minimum_requirements,accepting_inquiries,demo_reputation_score,demo_review_count)
values
('d0000000-0000-4000-8000-000000000001','Apex OFM Management','apex-ofm-management','Performance-led management for ambitious creators.','Full-service OFM operations focused on acquisition, conversion, retention, and creator support.','A fictional demonstration agency showing how a complete OFM profile appears inside Avera Privé. No real services are offered.','United States','Miami','https://apex-ofm.example',array['Account Management','Chatter Management','PPV Strategy','Fan Retention','Social Media Growth'],array['Lifestyle','Fitness','Glamour'],array['United States','Canada','United Kingdom'],'approved',true,'published',now(),now(),true,'Full-service OFM',2021,'11–25',array['English','Spanish'],'Established creators seeking structured revenue and retention operations.','Consistent content schedule and verified legal-age identity.',false,4.7,38),
('d0000000-0000-4000-8000-000000000002','VelvetFans Agency','velvetfans-agency','Premium positioning for distinctive creator brands.','Boutique OFM management combining brand direction, content planning, and high-touch fan engagement.','A fictional boutique OFM profile created exclusively for directory and workflow testing.','United Kingdom','London','https://velvetfans.example',array['Brand Strategy','Content Planning','Chatter Management','Retention Campaigns'],array['Luxury','Fashion','Glamour'],array['United Kingdom','Europe','United States'],'approved',true,'published',now(),now(),true,'Boutique OFM',2022,'6–10',array['English','French'],'Creators building premium subscription brands.','Minimum three publishing days per week.',false,4.5,24),
('d0000000-0000-4000-8000-000000000003','CreatorVault OFM','creatorvault-ofm','Secure systems for scalable creator operations.','Operations-focused OFM support covering team workflows, account security, analytics, and sales processes.','This is fictional demonstration content and does not represent an operating company.','Canada','Toronto','https://creatorvault.example',array['Account Operations','Security Review','Sales Analytics','Team Workflows','Fan Retention'],array['Lifestyle','Gaming','Cosplay'],array['Canada','United States'],'approved',true,'published',now(),now(),true,'Operations OFM',2020,'26–50',array['English','French'],'Creators who need documented processes and a managed support team.','Active account with six months of content history.',false,4.3,31),
('d0000000-0000-4000-8000-000000000004','EliteFan Management','elitefan-management','Round-the-clock fan engagement operations.','A fictional 24/7 OFM operations team specializing in inbox coverage, scripts, and retention.','Demonstration profile only. The company, results, and contact details are fictional.','Australia','Sydney','https://elitefan.example',array['24/7 Chat Operations','Sales Scripts','Retention','Account Management'],array['Fitness','Lifestyle','Travel'],array['Australia','New Zealand','United Kingdom'],'approved',true,'published',now(),now(),true,'Chat-focused OFM',2021,'26–50',array['English'],'Creators requiring extended-hour inbox coverage.','Daily content availability and an established subscriber base.',false,4.2,27),
('d0000000-0000-4000-8000-000000000005','Monarch OFM Partners','monarch-ofm-partners','Strategic growth with creator-first account control.','Creator-first OFM management with transparent reporting, content calendars, and revenue optimization.','Fictional profile used to test moderation, comparison, and directory presentation.','United States','Los Angeles','https://monarch-ofm.example',array['Growth Strategy','Content Calendar','Revenue Optimization','Creator Support'],array['Entertainment','Glamour','Lifestyle'],array['United States','Canada','Australia'],'approved',true,'published',now(),now(),true,'Creator-first OFM',2019,'11–25',array['English','Spanish'],'Full-time creators who want collaborative management.','Weekly planning availability and consistent content production.',false,4.6,45),
('d0000000-0000-4000-8000-000000000006','NovaMuse Management','novamuse-management','Creative direction meets structured monetization.','Fictional OFM services for creator branding, content ideation, messaging, and launch strategy.','This fictional agency exists only to demonstrate Avera Privé product features.','Germany','Berlin','https://novamuse.example',array['Creative Direction','Content Ideation','Launch Strategy','Fan Messaging'],array['Alternative','Cosplay','Gaming'],array['Germany','Europe','United Kingdom'],'approved',true,'published',now(),now(),true,'Creative OFM',2022,'6–10',array['English','German'],'Alternative and creative-niche creators developing a clear brand.','A defined niche and willingness to follow a content calendar.',false,4.1,19),
('d0000000-0000-4000-8000-000000000007','FanScale Agency','fanscale-agency','Data-informed conversion and subscriber growth.','Analytics-led OFM management focused on funnels, pricing tests, PPV strategy, and retention cohorts.','Fictional data and profile information for platform testing only.','Netherlands','Amsterdam','https://fanscale.example',array['Conversion Optimization','Pricing Strategy','PPV Campaigns','Retention Analytics'],array['Lifestyle','Fitness','Couples'],array['Europe','United Kingdom','North America'],'approved',true,'published',now(),now(),true,'Growth OFM',2020,'11–25',array['English','Dutch'],'Growth-stage creators with measurable acquisition channels.','Minimum three months of account analytics.',false,4.0,22),
('d0000000-0000-4000-8000-000000000008','Privé Creator Management','prive-creator-management-demo','Discreet management for premium creator businesses.','A fictional premium OFM profile centered on discretion, brand safety, and high-touch operations.','Not affiliated with Avera Privé. This deliberately fictional name is shown only in demo mode.','France','Paris','https://privecreator.example',array['Brand Safety','Account Management','VIP Fan Strategy','Content Planning'],array['Luxury','Fashion','Glamour'],array['France','Europe','United Kingdom'],'approved',true,'published',now(),now(),true,'Premium OFM',2021,'6–10',array['English','French'],'Premium creators prioritizing privacy and brand presentation.','Established visual identity and consistent publishing capability.',false,4.4,18),
('d0000000-0000-4000-8000-000000000009','Ascend OFM Group','ascend-ofm-group','International expansion for creator-led businesses.','Multilingual fictional OFM management supporting localization, audience expansion, and remote operations.','A demonstration agency with no real employees, customers, or commercial services.','United Arab Emirates','Dubai','https://ascend-ofm.example',array['International Growth','Localization','Chatter Management','Creator Recruitment'],array['Lifestyle','Travel','Fitness'],array['Middle East','Europe','Southeast Asia'],'approved',true,'published',now(),now(),true,'International OFM',2020,'26–50',array['English','Arabic','Spanish'],'Creators entering multiple geographic markets.','Reliable content pipeline and completed compliance documentation.',false,4.0,20),
('d0000000-0000-4000-8000-000000000010','Obsidian Fan Management','obsidian-fan-management','Structured sales operations for high-volume accounts.','Fictional high-volume OFM management covering sales teams, quality assurance, and account reporting.','All information on this demonstration profile is fictional.','United States','New York','https://obsidianfan.example',array['Sales Operations','Quality Assurance','Team Training','Account Reporting'],array['Entertainment','Lifestyle','Glamour'],array['United States','Canada','United Kingdom'],'approved',true,'published',now(),now(),true,'Sales-led OFM',2018,'51–100',array['English','Spanish'],'High-volume creators needing documented team oversight.','Proven subscriber activity and daily operational availability.',false,3.9,54),
('d0000000-0000-4000-8000-000000000011','Luminary OFM','luminary-ofm','Launch support for the next generation of creators.','A fictional OFM agency specializing in onboarding, account setup, content planning, and early-stage growth.','Demonstration profile created for testing the Avera Privé marketplace experience.','Philippines','Makati','https://luminary-ofm.example',array['Creator Onboarding','Account Setup','Content Planning','Social Media Growth'],array['Lifestyle','Gaming','Cosplay'],array['Philippines','Southeast Asia','Australia'],'approved',true,'published',now(),now(),true,'Launch OFM',2023,'6–10',array['English','Filipino'],'New creators who need structured launch support.','Verified legal-age identity and capacity for regular content.',false,4.2,16),
('d0000000-0000-4000-8000-000000000012','CrownCreator Agency','crowncreator-agency','Personalized OFM support without losing creator control.','Fictional boutique management with collaborative approvals, fan messaging, and weekly performance reporting.','This agency is fictional and cannot accept inquiries or verification.','Spain','Barcelona','https://crowncreator.example',array['Account Management','Fan Messaging','Weekly Reporting','Content Strategy'],array['Fashion','Travel','Lifestyle'],array['Spain','Europe','Latin America'],'approved',true,'published',now(),now(),true,'Boutique OFM',2022,'6–10',array['English','Spanish'],'Creators seeking a small collaborative account team.','Weekly content output and participation in review meetings.',false,4.3,21),
('d0000000-0000-4000-8000-000000000013','Atlas OFM Solutions','atlas-ofm-solutions','Operational infrastructure for distributed creator teams.','A fictional OFM operations provider demonstrating staffing, workflow, training, and analytics capabilities.','This test listing does not describe a real registered business.','Singapore','Singapore','https://atlas-ofm.example',array['Team Staffing','Chatter Training','Workflow Design','Performance Analytics'],array['Lifestyle','Fitness','Entertainment'],array['Southeast Asia','Australia','United Kingdom'],'approved',true,'published',now(),now(),true,'Operations OFM',2019,'26–50',array['English','Mandarin','Filipino'],'Established creators building distributed support operations.','Documented processes and a designated account decision-maker.',false,4.1,29),
('d0000000-0000-4000-8000-000000000014','MuseFlow Management','museflow-management','Consistent content, conversation, and retention systems.','Fictional OFM management aligning content calendars with messaging campaigns and retention workflows.','Created solely as safe demonstration content for Avera Privé.','Italy','Milan','https://museflow.example',array['Content Calendar','Campaign Planning','Chatter Management','Retention'],array['Fashion','Glamour','Lifestyle'],array['Italy','Europe','United Kingdom'],'approved',true,'published',now(),now(),true,'Content-led OFM',2021,'11–25',array['English','Italian'],'Creators who want coordinated content and inbox campaigns.','A stable publishing schedule and brand usage rights.',false,4.4,26),
('d0000000-0000-4000-8000-000000000015','EmpireFan Partners','empirefan-partners','End-to-end management for established creator brands.','A fictional full-service OFM company covering strategy, messaging, retention, team management, and reporting.','No real company is represented by this demonstration listing.','Canada','Vancouver','https://empirefan.example',array['Full Account Management','Chatter Management','Retention','Team Management','Reporting'],array['Fitness','Lifestyle','Entertainment'],array['Canada','United States','Australia'],'approved',true,'published',now(),now(),true,'Full-service OFM',2018,'51–100',array['English','French'],'Established creators seeking complete day-to-day operations.','Active audience, consistent content, and completed identity checks.',false,4.3,47)
on conflict (slug) do update set
  tagline=excluded.tagline,positioning_statement=excluded.positioning_statement,about=excluded.about,country=excluded.country,city=excluded.city,
  website_url=excluded.website_url,services=excluded.services,creator_niches=excluded.creator_niches,regions_served=excluded.regions_served,
  demo_profile=true,category=excluded.category,founded_year=excluded.founded_year,employee_count_range=excluded.employee_count_range,
  languages=excluded.languages,ideal_client=excluded.ideal_client,minimum_requirements=excluded.minimum_requirements,
  accepting_inquiries=false,demo_reputation_score=excluded.demo_reputation_score,demo_review_count=excluded.demo_review_count,updated_at=now();

create or replace view public.ap_public_agencies as
select a.id,a.name,a.slug,a.tagline,a.positioning_statement,a.about,a.country,a.city,a.website_url,a.logo_url,a.cover_image_url,
       a.services,a.creator_niches,a.regions_served,a.social_links,a.published_at,a.category,a.founded_year,a.employee_count_range,
       a.languages,a.ideal_client,a.minimum_requirements,a.accepting_inquiries,a.demo_profile,a.demo_reputation_score,a.demo_review_count,
       case when a.demo_profile then false else exists(select 1 from public.ap_verifications v where v.agency_id=a.id and v.status='approved') end as verified,
       case when not a.demo_profile and exists(select 1 from public.ap_verifications v where v.agency_id=a.id and v.status='approved') then 'verified' else 'unverified' end as verification_status,
       coalesce((select round(avg(r.rating)::numeric,2) from public.ap_reviews r where r.agency_id=a.id and r.status='published'),0) as average_rating,
       (select count(*) from public.ap_reviews r where r.agency_id=a.id and r.status='published') as review_count
from public.ap_agencies a where a.published=true and a.publication_status='published' and a.status='approved';

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
