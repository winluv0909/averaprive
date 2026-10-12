begin;

create or replace view public.ap_public_agencies as
select a.id,a.name,a.slug,a.tagline,a.positioning_statement,a.about,a.country,a.city,a.website_url,a.logo_url,a.cover_image_url,
       a.services,a.creator_niches,a.regions_served,a.social_links,a.published_at,
       exists(select 1 from public.ap_verifications v where v.agency_id=a.id and v.status='approved') as verified,
       case when exists(select 1 from public.ap_verifications v where v.agency_id=a.id and v.status='approved') then 'verified' else 'unverified' end as verification_status,
       coalesce((select round(avg(r.rating)::numeric,2) from public.ap_reviews r where r.agency_id=a.id and r.status='published'),0) as average_rating,
       (select count(*) from public.ap_reviews r where r.agency_id=a.id and r.status='published') as review_count
from public.ap_agencies a where a.published=true and a.publication_status='published' and a.status='approved';

grant select on public.ap_public_agencies to anon,authenticated;

create table if not exists public.ap_agency_sources (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.ap_agencies(id) on delete cascade,
  source_url text not null, source_type text not null check(source_type in ('official_site','business_registry','third_party_review','social_profile','editorial')),
  retrieved_at timestamptz not null default now(), notes text, unique(agency_id,source_url)
);
alter table public.ap_agency_sources enable row level security;
create policy "agency_sources_staff_read" on public.ap_agency_sources for select to authenticated using(ap_private.is_staff(null));
grant select on public.ap_agency_sources to authenticated;

commit;
