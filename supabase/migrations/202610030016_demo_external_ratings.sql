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

-- Fictional agency and rating inserts removed from the production migration chain.

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
