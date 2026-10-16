-- Copy into the migration created by: npx supabase migration new agency_registration_numbers
begin;

-- Platform identifiers are private records, not legal-registration evidence or badges.
create table public.ap_agency_registration_numbers (
  id uuid primary key,
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  proof_hash text not null check (proof_hash ~ '^[0-9a-f]{64}$'),
  registration_number text not null unique check (registration_number ~ '^AP-[0-9]{4}-[0-9A-F]{20}$'),
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed')),
  last_delivery_id uuid,
  attempts integer not null default 0 check (attempts between 0 and 5),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  verified_at timestamptz,
  agency_id uuid unique references public.ap_agencies(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  bound_at timestamptz,
  check ((agency_id is null) = (bound_at is null))
);
create index ap_registration_numbers_email on public.ap_agency_registration_numbers(email, created_at desc);
create index ap_registration_numbers_owner on public.ap_agency_registration_numbers(owner_user_id);

create table public.ap_registration_number_deliveries (
  id uuid primary key,
  reservation_id uuid not null references public.ap_agency_registration_numbers(id) on delete cascade,
  email text not null,
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed')),
  created_at timestamptz not null default now()
);
create index ap_registration_number_deliveries_recent on public.ap_registration_number_deliveries(created_at desc);
create index ap_registration_number_deliveries_email on public.ap_registration_number_deliveries(email,created_at desc);
create index ap_registration_number_deliveries_visitor on public.ap_registration_number_deliveries(visitor_hash,created_at desc);
create index ap_registration_number_deliveries_reservation on public.ap_registration_number_deliveries(reservation_id);

alter table public.ap_agency_registration_numbers enable row level security;
alter table public.ap_registration_number_deliveries enable row level security;
revoke all on public.ap_agency_registration_numbers, public.ap_registration_number_deliveries from public, anon, authenticated;
grant select, insert, update on public.ap_agency_registration_numbers, public.ap_registration_number_deliveries to service_role;

create function public.ap_prepare_registration_number(
  delivery_id uuid, reservation_id uuid, target_email text,
  target_visitor_hash text, target_proof_hash text, proposed_number text
) returns text language plpgsql security invoker set search_path = '' as $$
declare
  normalized_email text := lower(btrim(target_email));
  saved public.ap_agency_registration_numbers%rowtype;
begin
  if delivery_id is null or reservation_id is null
    or normalized_email is null or char_length(normalized_email) not between 3 and 254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or target_visitor_hash is null or target_visitor_hash !~ '^[0-9a-f]{64}$'
    or target_proof_hash is null or target_proof_hash !~ '^[0-9a-f]{64}$'
    or proposed_number is null or proposed_number !~ '^AP-[0-9]{4}-[0-9A-F]{20}$' then
    raise exception 'INVALID_REGISTRATION_NUMBER_REQUEST';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(20261016, 81133);
  if exists (
    select 1 from public.ap_registration_number_deliveries d
    where d.created_at > now() - interval '60 seconds'
      and (d.email = normalized_email or d.visitor_hash = target_visitor_hash)
  ) then raise exception 'REGISTRATION_NUMBER_COOLDOWN'; end if;
  if (select count(*) from public.ap_registration_number_deliveries d
      where d.created_at > now() - interval '1 hour'
      and (d.email = normalized_email or d.visitor_hash = target_visitor_hash)) >= 5
    or (select count(*) from public.ap_registration_number_deliveries d
        where d.created_at > now() - interval '1 hour') >= 100 then
    raise exception 'REGISTRATION_NUMBER_RATE_LIMIT';
  end if;

  select * into saved from public.ap_agency_registration_numbers r
  where r.id = reservation_id for update;
  if found then
    if saved.email <> normalized_email or saved.proof_hash <> target_proof_hash then
      raise exception 'REGISTRATION_NUMBER_PROOF_MISMATCH';
    end if;
    if saved.bound_at is not null then raise exception 'REGISTRATION_NUMBER_ALREADY_USED'; end if;
  else
    insert into public.ap_agency_registration_numbers(id,email,proof_hash,registration_number)
    values (reservation_id,normalized_email,target_proof_hash,proposed_number)
    returning * into saved;
  end if;
  insert into public.ap_registration_number_deliveries(id,reservation_id,email,visitor_hash)
  values (delivery_id,reservation_id,normalized_email,target_visitor_hash);
  update public.ap_agency_registration_numbers r
  set delivery_status='pending', last_delivery_id=delivery_id,
      attempts=0, verified_at=null, expires_at=now()+interval '15 minutes'
  where r.id=reservation_id;
  return saved.registration_number;
end; $$;

create function public.ap_verify_registration_number(
  reservation_id uuid, target_email text, target_proof_hash text, supplied_number text
) returns text language plpgsql security invoker set search_path = '' as $$
declare saved public.ap_agency_registration_numbers%rowtype;
begin
  select * into saved from public.ap_agency_registration_numbers r
  where r.id=reservation_id and r.email=lower(btrim(target_email))
    and r.proof_hash=target_proof_hash for update;
  if not found then return 'invalid'; end if;
  if saved.bound_at is not null then return 'used'; end if;
  if saved.expires_at <= now() then return 'expired'; end if;
  if saved.delivery_status <> 'sent' then return 'unavailable'; end if;
  if saved.attempts >= 5 then return 'locked'; end if;
  if supplied_number is null or saved.registration_number <> upper(btrim(supplied_number)) then
    update public.ap_agency_registration_numbers r set attempts=r.attempts+1 where r.id=saved.id;
    return 'invalid';
  end if;
  update public.ap_agency_registration_numbers r
  set verified_at=coalesce(r.verified_at,now()) where r.id=saved.id;
  return 'verified';
end; $$;

-- Called only by trusted server code after validating the authenticated user.
-- User-editable signup metadata is only a lookup hint, never authorization.
create function public.ap_bind_registration_number(
  reservation_id uuid, supplied_number text, target_user uuid, target_agency uuid, target_owner_email text
) returns text language plpgsql security invoker set search_path = '' as $$
declare
  saved public.ap_agency_registration_numbers%rowtype;
  confirmed_email text;
begin
  -- The server supplies this only from auth.getUser(), after checking email_confirmed_at.
  -- Keeping Auth schema reads in the Auth API avoids widening database grants.
  confirmed_email := lower(btrim(target_owner_email));
  if confirmed_email is null or confirmed_email = '' or target_user is null or not exists (
    select 1 from public.ap_agency_memberships m
    where m.agency_id=target_agency and m.user_id=target_user
      and m.role='owner' and m.status='active'
  ) then raise exception 'REGISTRATION_NUMBER_OWNER_REQUIRED'; end if;

  select * into saved from public.ap_agency_registration_numbers r
  where r.id=reservation_id for update;
  if not found or saved.email <> confirmed_email
    or saved.registration_number is distinct from supplied_number
    or saved.verified_at is null or saved.delivery_status <> 'sent' then
    raise exception 'VERIFIED_REGISTRATION_NUMBER_REQUIRED';
  end if;
  if saved.bound_at is not null then
    if saved.agency_id=target_agency and saved.owner_user_id=target_user then
      return saved.registration_number;
    end if;
    raise exception 'REGISTRATION_NUMBER_ALREADY_USED';
  end if;
  -- Email confirmation may finish after the 15-minute number-entry window.
  -- The number must already have been verified, and can bind for seven days.
  if saved.verified_at < now()-interval '7 days' then
    raise exception 'REGISTRATION_NUMBER_RESERVATION_EXPIRED';
  end if;
  update public.ap_agency_registration_numbers r
  set agency_id=target_agency,owner_user_id=target_user,bound_at=now()
  where r.id=saved.id;
  return saved.registration_number;
end; $$;

revoke all on function public.ap_prepare_registration_number(uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.ap_verify_registration_number(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.ap_bind_registration_number(uuid,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ap_prepare_registration_number(uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.ap_verify_registration_number(uuid,text,text,text) to service_role;
grant execute on function public.ap_bind_registration_number(uuid,text,uuid,uuid,text) to service_role;
commit;
