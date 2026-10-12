begin;

create extension if not exists pgcrypto;

create table if not exists public.ap_agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  tagline text,
  positioning_statement text,
  about text,
  country text,
  city text,
  website_url text,
  logo_url text,
  cover_image_url text,
  services text[] not null default '{}',
  creator_niches text[] not null default '{}',
  regions_served text[] not null default '{}',
  social_links jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended','archived')),
  published boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ap_verifications (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.ap_agencies(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','needs_information','approved','rejected','revoked')),
  evidence_private jsonb not null default '{}'::jsonb,
  decision_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ap_reviews (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.ap_agencies(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (length(trim(body)) between 40 and 5000),
  relationship_evidence_private jsonb not null default '{}'::jsonb,
  relationship_checked boolean not null default false,
  status text not null default 'pending' check (status in ('pending','published','rejected','hidden')),
  moderator_id uuid references auth.users(id) on delete set null,
  moderation_reason text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ap_reports (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.ap_agencies(id) on delete cascade,
  review_id uuid references public.ap_reviews(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (length(trim(reason)) between 20 and 5000),
  evidence_private jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','investigating','resolved','dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.ap_fraud_flags (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.ap_agencies(id) on delete cascade,
  review_id uuid references public.ap_reviews(id) on delete cascade,
  signal_type text not null,
  risk_score numeric(5,2),
  evidence_private jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','investigating','resolved','dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists ap_agencies_public_idx on public.ap_agencies(published, status, country);
create index if not exists ap_reviews_agency_status_idx on public.ap_reviews(agency_id, status, created_at desc);
create index if not exists ap_verifications_agency_status_idx on public.ap_verifications(agency_id, status, created_at desc);
create index if not exists ap_reports_agency_status_idx on public.ap_reports(agency_id, status, created_at desc);

alter table public.ap_agencies enable row level security;
alter table public.ap_verifications enable row level security;
alter table public.ap_reviews enable row level security;
alter table public.ap_reports enable row level security;
alter table public.ap_fraud_flags enable row level security;

drop policy if exists "published_agencies_public_read" on public.ap_agencies;
create policy "published_agencies_public_read" on public.ap_agencies for select using (published = true);
drop policy if exists "published_reviews_public_read" on public.ap_reviews;
create policy "published_reviews_public_read" on public.ap_reviews for select using (status = 'published');

grant select on public.ap_agencies, public.ap_reviews to anon;

commit;
