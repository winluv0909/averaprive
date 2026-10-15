-- Require explicit consent and reject missing inquiry fields.
begin;

create or replace function public.ap_submit_inquiry(
  target_agency uuid,
  visitor_session text,
  contact_name text,
  contact_email text,
  inquiry_message text,
  event_source text,
  contact_consent boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  inquiry_id uuid;
  eligible boolean;
begin
  if contact_consent is distinct from true then
    raise exception 'Contact consent is required';
  end if;

  if visitor_session is null
     or visitor_session !~ '^[a-zA-Z0-9_-]{16,80}$' then
    raise exception 'Invalid session';
  end if;

  contact_name := trim(contact_name);
  contact_email := lower(trim(contact_email));
  inquiry_message := trim(inquiry_message);

  if contact_name is null
     or length(contact_name) not between 2 and 100 then
    raise exception 'Invalid name';
  end if;

  if contact_email is null
     or length(contact_email) > 254
     or contact_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Invalid email';
  end if;

  if inquiry_message is null
     or length(inquiry_message) not between 20 and 3000 then
    raise exception 'Inquiry must be between 20 and 3000 characters';
  end if;

  select published and accepting_inquiries and not demo_profile
  into eligible
  from public.ap_agencies
  where id = target_agency;

  if not coalesce(eligible, false) then
    raise exception 'Agency is not accepting public inquiries';
  end if;

  -- Serialize submissions for the same agency and visitor.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'inquiry:' || target_agency::text || ':' || visitor_session, 0
    )
  );

  if exists (
    select 1
    from public.ap_inquiries
    where session_id = visitor_session
      and agency_id = target_agency
      and created_at > now() - interval '15 minutes'
  ) then
    raise exception 'Please wait before sending another inquiry';
  end if;

  insert into public.ap_inquiries(
    agency_id, sender_name, sender_email, message,
    session_id, source, consent_to_contact
  )
  values (
    target_agency, contact_name, contact_email, inquiry_message,
    visitor_session,
    case
      when event_source in ('organic','sponsored','direct','search')
        then event_source
      else 'organic'
    end,
    true
  )
  returning id into inquiry_id;

  insert into public.ap_marketplace_events(
    agency_id, event_type, session_id,
    page_path, source, consent_state
  )
  values (
    target_agency, 'inquiry_submitted', visitor_session,
    '/agency-profile.html', 'organic', 'essential'
  );

  return inquiry_id;
end;
$function$;

commit;