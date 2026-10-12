begin;

create table if not exists public.ap_external_ratings (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.ap_agencies(id) on delete cascade,
  platform text not null,
  rating numeric(2,1),
  review_count integer,
  rating_status text not null check (rating_status in ('active','unavailable','no_profile')),
  profile_url text,
  is_demo boolean not null default false,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id,platform),
  constraint ap_external_rating_range check (rating is null or rating between 1 and 5),
  constraint ap_demo_external_url_guard check (not is_demo or profile_url is null),
  constraint ap_active_external_rating_complete check (rating_status <> 'active' or (rating is not null and review_count is not null and review_count >= 0))
);

alter table public.ap_external_ratings enable row level security;
create policy "external_ratings_public_read" on public.ap_external_ratings for select using (
  exists(select 1 from public.ap_agencies a where a.id=agency_id and a.published=true)
);
grant select on public.ap_external_ratings to anon,authenticated;

insert into public.ap_agencies
  (id,name,slug,tagline,positioning_statement,about,country,city,website_url,services,creator_niches,regions_served,status,published,publication_status,approved_at,published_at,demo_profile,category,founded_year,employee_count_range,languages,ideal_client,minimum_requirements,accepting_inquiries,demo_reputation_score,demo_review_count)
values
('d0000000-0000-4000-8000-000000000016','Orbit OFM Studio','orbit-ofm-studio','Traffic systems built for creator discovery.','A fictional OFM studio focused on social traffic strategy, profile funnels, and creator launch campaigns.','Fictional demonstration profile only; no commercial services or real-world claims are represented.','United States','Austin','https://orbit-ofm.example',array['TikTok Growth','Instagram Growth','Reddit Strategy','Profile Funnels','Creator Launches'],array['Lifestyle','Fitness','Cosplay'],array['United States','Canada','United Kingdom'],'approved',true,'published',now(),now(),true,'Traffic OFM',2022,'11–25',array['English','Spanish'],'Creators who need repeatable social acquisition systems.','Consistent short-form content and completed legal-age verification.',false,4.1,23),
('d0000000-0000-4000-8000-000000000017','Nexus Chatter Collective','nexus-chatter-collective','Human-led conversations with measurable quality control.','A fictional specialist OFM team for multilingual chat operations, quality assurance, and retention.','This profile is test inventory for Avera Privé and does not describe a real agency.','Philippines','Taguig','https://nexuschatter.example',array['24/7 Chat Operations','Chatter Training','Quality Assurance','Fan Retention','Sales Scripts'],array['Lifestyle','Gaming','Glamour'],array['Southeast Asia','United States','Australia'],'approved',true,'published',now(),now(),true,'Chat Operations OFM',2021,'51–100',array['English','Filipino','Spanish'],'Established creators requiring professionally supervised messaging coverage.','Stable subscriber activity and approved conversation guidelines.',false,4.0,35),
('d0000000-0000-4000-8000-000000000018','Safeguard Creator Ops','safeguard-creator-ops','Compliance and recovery support for creator businesses.','A fictional operations agency specializing in account security, compliance workflows, recovery planning, and access controls.','Fictional profile used to demonstrate security-focused OFM discovery.','Ireland','Dublin','https://safeguard-creator.example',array['Account Security','Compliance Review','Access Controls','Account Recovery Planning','Operations Audit'],array['Lifestyle','Entertainment','Fitness'],array['Europe','United Kingdom','North America'],'approved',true,'published',now(),now(),true,'Compliance OFM',2020,'11–25',array['English'],'Creator teams seeking stronger operational security and documented account access.','Identity documentation and willingness to complete a security review.',false,4.5,28),
('d0000000-0000-4000-8000-000000000019','Pulse PPV Management','pulse-ppv-management','Campaign planning for consistent subscriber value.','A fictional OFM profile centered on PPV calendars, offer testing, segmentation, and retention campaigns.','Demonstration company only. Rating availability is intentionally simulated for testing.','United Kingdom','Manchester','https://pulse-ppv.example',array['PPV Strategy','Campaign Calendar','Audience Segmentation','Offer Testing','Retention'],array['Glamour','Fitness','Lifestyle'],array['United Kingdom','Europe','United States'],'approved',true,'published',now(),now(),true,'PPV OFM',2021,'11–25',array['English'],'Creators with active audiences who need structured campaign execution.','Regular content production and at least three months of account history.',false,3.8,17),
('d0000000-0000-4000-8000-000000000020','Origin Creator Launch','origin-creator-launch','Responsible onboarding for first-time professional creators.','A fictional launch-focused OFM agency covering onboarding, brand setup, content systems, and early audience development.','This test company intentionally has no simulated external profile.','New Zealand','Auckland','https://origincreator.example',array['Creator Onboarding','Brand Setup','Content Systems','Launch Planning','Social Growth'],array['Lifestyle','Travel','Wellness'],array['New Zealand','Australia','Southeast Asia'],'approved',true,'published',now(),now(),true,'Launch OFM',2023,'1–5',array['English'],'New professional creators preparing a structured launch.','Verified legal-age identity and a 30-day content plan.',false,4.0,12)
on conflict(slug) do update set demo_profile=true,accepting_inquiries=false,services=excluded.services,creator_niches=excluded.creator_niches,regions_served=excluded.regions_served,languages=excluded.languages,updated_at=now();

insert into public.ap_external_ratings(agency_id,platform,rating,review_count,rating_status,profile_url,is_demo,last_checked_at)
values
('d0000000-0000-4000-8000-000000000001','trustpilot',2.8,37,'active',null,true,now()),
('d0000000-0000-4000-8000-000000000002','trustpilot',4.3,84,'active',null,true,now()),
('d0000000-0000-4000-8000-000000000003','trustpilot',3.6,52,'active',null,true,now()),
('d0000000-0000-4000-8000-000000000004','trustpilot',4.0,106,'active',null,true,now()),
('d0000000-0000-4000-8000-000000000005','trustpilot',4.6,129,'active',null,true,now()),
('d0000000-0000-4000-8000-000000000006','trustpilot',3.2,21,'active',null,true,now()),
('d0000000-0000-4000-8000-000000000007','trustpilot',2.4,44,'active',null,true,now()),
('d0000000-0000-4000-8000-000000000008','trustpilot',4.5,63,'active',null,true,now()),
('d0000000-0000-4000-8000-000000000009','trustpilot',3.8,75,'active',null,true,now()),
('d0000000-0000-4000-8000-000000000010','trustpilot',2.1,91,'active',null,true,now()),
('d0000000-0000-4000-8000-000000000011','trustpilot',4.2,32,'active',null,true,now()),
('d0000000-0000-4000-8000-000000000012','trustpilot',3.5,48,'active',null,true,now()),
('d0000000-0000-4000-8000-000000000013','trustpilot',4.1,57,'active',null,true,now()),
('d0000000-0000-4000-8000-000000000014','trustpilot',3.0,29,'active',null,true,now()),
('d0000000-0000-4000-8000-000000000015','trustpilot',2.6,68,'active',null,true,now()),
('d0000000-0000-4000-8000-000000000016','trustpilot',3.9,41,'active',null,true,now()),
('d0000000-0000-4000-8000-000000000017','trustpilot',4.4,118,'active',null,true,now()),
('d0000000-0000-4000-8000-000000000018','trustpilot',4.7,73,'active',null,true,now()),
('d0000000-0000-4000-8000-000000000019','trustpilot',null,null,'unavailable',null,true,now()),
('d0000000-0000-4000-8000-000000000020','trustpilot',null,null,'no_profile',null,true,now())
on conflict(agency_id,platform) do update set rating=excluded.rating,review_count=excluded.review_count,rating_status=excluded.rating_status,profile_url=null,is_demo=true,last_checked_at=excluded.last_checked_at,updated_at=now();

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
       (select er.is_demo from public.ap_external_ratings er where er.agency_id=a.id and er.platform='trustpilot') as external_rating_is_demo
from public.ap_agencies a where a.published=true and a.publication_status='published' and a.status='approved';

commit;
