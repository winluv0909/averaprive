begin;

create table if not exists public.ap_marketplace_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.ap_agencies(id) on delete cascade,
  event_type text not null check (event_type in ('directory_impression','profile_view','contact_open','website_click','inquiry_submitted')),
  session_id text not null check (session_id ~ '^[a-zA-Z0-9_-]{16,80}$'),
  page_path text not null,
  source text not null default 'organic' check (source in ('organic','sponsored','direct','search')),
  placement_id uuid references public.ap_sponsored_placements(id) on delete set null,
  consent_state text not null default 'essential' check (consent_state in ('essential','analytics')),
  occurred_at timestamptz not null default now()
);

create index if not exists ap_marketplace_events_time on public.ap_marketplace_events(occurred_at desc);
create index if not exists ap_marketplace_events_agency on public.ap_marketplace_events(agency_id,event_type,occurred_at desc);

create table if not exists public.ap_inquiries (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.ap_agencies(id) on delete cascade,
  sender_name text not null,
  sender_email text not null,
  message text not null,
  session_id text not null check (session_id ~ '^[a-zA-Z0-9_-]{16,80}$'),
  source text not null default 'organic' check (source in ('organic','sponsored','direct','search')),
  status text not null default 'new' check (status in ('new','delivered','accepted','declined','closed','spam')),
  qualification_status text not null default 'unreviewed' check (qualification_status in ('unreviewed','qualified','unqualified','fraud_flagged')),
  consent_to_contact boolean not null,
  reviewed_by uuid references auth.users(id) on delete set null,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ap_inquiries_agency on public.ap_inquiries(agency_id,status,created_at desc);

alter table public.ap_marketplace_events enable row level security;
alter table public.ap_inquiries enable row level security;

drop policy if exists "analytics_staff_read" on public.ap_marketplace_events;
create policy "analytics_staff_read" on public.ap_marketplace_events for select to authenticated
using (ap_private.is_staff(array['super_admin','finance']));

drop policy if exists "inquiries_staff_read" on public.ap_inquiries;
create policy "inquiries_staff_read" on public.ap_inquiries for select to authenticated
using (ap_private.is_staff(array['super_admin','support']));

drop policy if exists "inquiries_agency_read" on public.ap_inquiries;
create policy "inquiries_agency_read" on public.ap_inquiries for select to authenticated
using (ap_private.has_agency_role(agency_id,array['owner','admin','analyst']));

revoke all on public.ap_marketplace_events from anon, authenticated;
revoke all on public.ap_inquiries from anon, authenticated;
grant select on public.ap_marketplace_events to authenticated;
grant select on public.ap_inquiries to authenticated;

create or replace function public.ap_record_marketplace_event(
  target_agency uuid, event_name text, visitor_session text, event_page text,
  event_source text default 'organic', analytics_consent boolean default false
) returns void language plpgsql security definer set search_path = '' as $$
declare is_public boolean;
begin
  if event_name not in ('directory_impression','profile_view','contact_open','website_click') then raise exception 'Invalid public event'; end if;
  if visitor_session !~ '^[a-zA-Z0-9_-]{16,80}$' then raise exception 'Invalid session'; end if;
  select published into is_public from public.ap_agencies where id=target_agency;
  if not coalesce(is_public,false) then raise exception 'Agency is not public'; end if;
  if exists(select 1 from public.ap_marketplace_events where agency_id=target_agency and event_type=event_name and session_id=visitor_session and occurred_at>now()-interval '30 minutes') then return; end if;
  insert into public.ap_marketplace_events(agency_id,event_type,session_id,page_path,source,consent_state)
  values(target_agency,event_name,visitor_session,left(coalesce(event_page,'/'),200),
    case when event_source in ('organic','sponsored','direct','search') then event_source else 'organic' end,
    case when analytics_consent then 'analytics' else 'essential' end);
end; $$;

create or replace function public.ap_update_inquiry(
  target_inquiry uuid, next_status text, next_qualification text, review_note text
) returns void language plpgsql security definer set search_path = '' as $$
declare target_agency uuid;
begin
  if not ap_private.is_staff(array['super_admin','support']) then raise exception 'Inquiry operations access required'; end if;
  if next_status not in ('new','delivered','accepted','declined','closed','spam') then raise exception 'Invalid inquiry status'; end if;
  if next_qualification not in ('unreviewed','qualified','unqualified','fraud_flagged') then raise exception 'Invalid qualification'; end if;
  if length(trim(coalesce(review_note,'')))<10 then raise exception 'A traceable decision note is required'; end if;
  update public.ap_inquiries set status=next_status,qualification_status=next_qualification,reviewed_by=auth.uid(),decision_note=trim(review_note),updated_at=now()
  where id=target_inquiry returning agency_id into target_agency;
  if target_agency is null then raise exception 'Inquiry not found'; end if;
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
  values(auth.uid(),target_agency,'inquiry.reviewed','inquiry',target_inquiry::text,jsonb_build_object('status',next_status,'qualification',next_qualification,'note',trim(review_note)));
end; $$;

create or replace function public.ap_submit_inquiry(
  target_agency uuid, visitor_session text, contact_name text, contact_email text,
  inquiry_message text, event_source text, contact_consent boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare inquiry_id uuid; is_public boolean;
begin
  select published into is_public from public.ap_agencies where id=target_agency;
  if not coalesce(is_public,false) then raise exception 'Agency is not accepting public inquiries'; end if;
  if visitor_session !~ '^[a-zA-Z0-9_-]{16,80}$' then raise exception 'Invalid session'; end if;
  if not contact_consent then raise exception 'Contact consent is required'; end if;
  if length(trim(contact_name))<2 or length(trim(contact_name))>100 then raise exception 'Invalid name'; end if;
  if contact_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'Invalid email'; end if;
  if length(trim(inquiry_message))<20 or length(trim(inquiry_message))>3000 then raise exception 'Inquiry must be between 20 and 3000 characters'; end if;
  if exists(select 1 from public.ap_inquiries where session_id=visitor_session and agency_id=target_agency and created_at>now()-interval '15 minutes') then raise exception 'Please wait before sending another inquiry'; end if;
  insert into public.ap_inquiries(agency_id,sender_name,sender_email,message,session_id,source,consent_to_contact)
  values(target_agency,trim(contact_name),lower(trim(contact_email)),trim(inquiry_message),visitor_session,
    case when event_source in ('organic','sponsored','direct','search') then event_source else 'organic' end,true)
  returning id into inquiry_id;
  insert into public.ap_marketplace_events(agency_id,event_type,session_id,page_path,source,consent_state)
  values(target_agency,'inquiry_submitted',visitor_session,'/agency-profile.html',
    case when event_source in ('organic','sponsored','direct','search') then event_source else 'organic' end,'essential');
  return inquiry_id;
end; $$;

revoke all on function public.ap_record_marketplace_event(uuid,text,text,text,text,boolean) from public;
revoke all on function public.ap_submit_inquiry(uuid,text,text,text,text,text,boolean) from public;
grant execute on function public.ap_record_marketplace_event(uuid,text,text,text,text,boolean) to anon, authenticated;
grant execute on function public.ap_submit_inquiry(uuid,text,text,text,text,text,boolean) to anon, authenticated;
revoke all on function public.ap_update_inquiry(uuid,text,text,text) from public;
grant execute on function public.ap_update_inquiry(uuid,text,text,text) to authenticated;

commit;
