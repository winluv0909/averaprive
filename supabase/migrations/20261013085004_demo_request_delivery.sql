-- AP Demo 01 — Install Private Demo Request Inbox
begin;
create table public.ap_demo_requests (
  id uuid primary key,
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
  details jsonb not null check (jsonb_typeof(details) = 'object' and details->>'consent' = 'true'),
  notification_status text not null default 'pending' check (notification_status in ('pending','sent','failed')),
  created_at timestamptz not null default now()
);
create index ap_demo_requests_recent on public.ap_demo_requests(created_at desc);
create index ap_demo_requests_visitor_recent on public.ap_demo_requests(visitor_hash,created_at desc);
create index ap_demo_requests_email_recent on public.ap_demo_requests((details->>'email'),created_at desc);
alter table public.ap_demo_requests enable row level security;
revoke all on public.ap_demo_requests from public, anon, authenticated;
grant select on public.ap_demo_requests to authenticated;
grant select, insert, update on public.ap_demo_requests to service_role;
create policy demo_request_staff_read on public.ap_demo_requests
for select to authenticated
using ((select ap_private.is_staff(array['super_admin','support'])));

-- Only the server's service role can call this function. It does not elevate privileges.
create function public.ap_record_demo_request(request_id uuid, visitor_hash text, request_details jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare previous public.ap_demo_requests%rowtype;
begin
  if request_id is null or visitor_hash is null or visitor_hash !~ '^[0-9a-f]{64}$'
    or request_details is null or jsonb_typeof(request_details) <> 'object'
    or request_details->>'consent' is distinct from 'true' then
    raise exception 'Invalid demo request';
  end if;
  -- A short transaction lock serializes the rate check and insert across server instances.
  perform pg_catalog.pg_advisory_xact_lock(20261013, 85004);
  select * into previous from public.ap_demo_requests where id=request_id;
  if found then
    if previous.details <> request_details or previous.visitor_hash <> visitor_hash then
      raise exception 'Demo request identifier already used';
    end if;
    return previous.id;
  end if;
  if (select count(*) from public.ap_demo_requests d
      where d.created_at > now()-interval '1 hour'
      and (d.visitor_hash=ap_record_demo_request.visitor_hash or d.details->>'email'=request_details->>'email')) >= 2
    or (select count(*) from public.ap_demo_requests where created_at > now()-interval '1 hour') >= 100 then
    raise exception 'DEMO_RATE_LIMIT';
  end if;
  insert into public.ap_demo_requests(id,visitor_hash,details)
  values(request_id,visitor_hash,request_details);
  return request_id;
end; $$;
revoke all on function public.ap_record_demo_request(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.ap_record_demo_request(uuid,text,jsonb) to service_role;
commit;

-- AP Demo 02 — Confirm Private Inbox Installation (read-only; creates no requests)
select
  (select relrowsecurity from pg_class where oid='public.ap_demo_requests'::regclass) as rls_enabled,
  not has_table_privilege('anon','public.ap_demo_requests','SELECT') as public_read_blocked,
  not has_table_privilege('authenticated','public.ap_demo_requests','INSERT') as direct_submission_blocked,
  not has_function_privilege('anon','public.ap_record_demo_request(uuid,text,jsonb)','EXECUTE') as public_rpc_blocked,
  has_function_privilege('service_role','public.ap_record_demo_request(uuid,text,jsonb)','EXECUTE') as server_submission_enabled,
  (select count(*) from public.ap_demo_requests) as saved_requests;
