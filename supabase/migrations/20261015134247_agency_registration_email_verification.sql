begin;

create table public.ap_registration_email_checks (
  id uuid primary key,
  email text not null
    check (
      email = lower(btrim(email))
      and char_length(email) between 3 and 254
    ),
  visitor_hash text not null
    check (visitor_hash ~ '^[0-9a-f]{64}$'),
  proof_hash text not null
    check (proof_hash ~ '^[0-9a-f]{64}$'),
  code_hash text not null
    check (code_hash ~ '^[0-9a-f]{64}$'),
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0
    check (attempts between 0 and 5),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  verified_at timestamptz,
  check (expires_at > created_at)
);

create index ap_registration_email_checks_email_recent
  on public.ap_registration_email_checks(email, created_at desc);

create index ap_registration_email_checks_visitor_recent
  on public.ap_registration_email_checks(visitor_hash, created_at desc);

create index ap_registration_email_checks_recent
  on public.ap_registration_email_checks(created_at desc);

alter table public.ap_registration_email_checks
  enable row level security;

-- Browser clients cannot read, create, or modify verification records.
revoke all on public.ap_registration_email_checks
  from public, anon, authenticated;

grant select, insert, update, delete
  on public.ap_registration_email_checks
  to service_role;

create function public.ap_begin_registration_email_check(
  check_id uuid,
  target_email text,
  target_visitor_hash text,
  target_proof_hash text,
  target_code_hash text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(target_email));
begin
  if check_id is null
    or normalized_email is null
    or char_length(normalized_email) not between 3 and 254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or target_visitor_hash is null
    or target_visitor_hash !~ '^[0-9a-f]{64}$'
    or target_proof_hash is null
    or target_proof_hash !~ '^[0-9a-f]{64}$'
    or target_code_hash is null
    or target_code_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'INVALID_REGISTRATION_EMAIL_CHECK';
  end if;

  -- Serialize creation so concurrent requests cannot bypass rate limits.
  perform pg_catalog.pg_advisory_xact_lock(20261015, 134247);

  if exists (
    select 1
    from public.ap_registration_email_checks c
    where c.created_at > now() - interval '60 seconds'
      and (
        c.email = normalized_email
        or c.visitor_hash = target_visitor_hash
      )
  ) then
    raise exception 'REGISTRATION_EMAIL_COOLDOWN';
  end if;

  if (
    select count(*)
    from public.ap_registration_email_checks c
    where c.created_at > now() - interval '1 hour'
      and (
        c.email = normalized_email
        or c.visitor_hash = target_visitor_hash
      )
  ) >= 5
  or (
    select count(*)
    from public.ap_registration_email_checks c
    where c.created_at > now() - interval '1 hour'
  ) >= 100 then
    raise exception 'REGISTRATION_EMAIL_RATE_LIMIT';
  end if;

  -- These short-lived records are not business-registration evidence.
  delete from public.ap_registration_email_checks
  where created_at < now() - interval '1 day';

  insert into public.ap_registration_email_checks (
    id, email, visitor_hash, proof_hash, code_hash
  )
  values (
    check_id,
    normalized_email,
    target_visitor_hash,
    target_proof_hash,
    target_code_hash
  );

  return check_id;
end;
$$;

create function public.ap_verify_registration_email_check(
  check_id uuid,
  target_email text,
  target_proof_hash text,
  supplied_code_hash text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved public.ap_registration_email_checks%rowtype;
begin
  if check_id is null
    or target_email is null
    or target_proof_hash is null
    or target_proof_hash !~ '^[0-9a-f]{64}$'
    or supplied_code_hash is null
    or supplied_code_hash !~ '^[0-9a-f]{64}$'
  then
    return 'invalid';
  end if;

  select c.* into saved
  from public.ap_registration_email_checks c
  where c.id = check_id
    and c.email = lower(btrim(target_email))
    and c.proof_hash = target_proof_hash
  for update;

  if not found then
    return 'invalid';
  end if;

  if saved.expires_at <= now() then
    return 'expired';
  end if;

  if saved.delivery_status <> 'sent' then
    return 'unavailable';
  end if;

  if saved.attempts >= 5 then
    return 'locked';
  end if;

  if saved.code_hash <> supplied_code_hash then
    update public.ap_registration_email_checks
    set attempts = attempts + 1
    where id = check_id;

    -- Return normally so failed-attempt increments are committed.
    return 'invalid';
  end if;

  update public.ap_registration_email_checks
  set verified_at = coalesce(verified_at, now())
  where id = check_id;

  return 'verified';
end;
$$;

revoke all on function public.ap_begin_registration_email_check(
  uuid, text, text, text, text
) from public, anon, authenticated;

revoke all on function public.ap_verify_registration_email_check(
  uuid, text, text, text
) from public, anon, authenticated;

grant execute on function public.ap_begin_registration_email_check(
  uuid, text, text, text, text
) to service_role;

grant execute on function public.ap_verify_registration_email_check(
  uuid, text, text, text
) to service_role;

commit;