begin;

drop policy if exists "inquiries_agency_read" on public.ap_inquiries;

create or replace function ap_private.has_active_paid_access(target_agency uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.ap_subscriptions
    where agency_id=target_agency and plan_code in ('prive','select','elite')
      and ((status='trialing' and trial_ends_at>now()) or (status='active' and (current_period_ends_at is null or current_period_ends_at>now())))
  );
$$;
revoke all on function ap_private.has_active_paid_access(uuid) from public;
grant execute on function ap_private.has_active_paid_access(uuid) to authenticated;

create or replace function public.ap_agency_lead_inbox(target_agency uuid)
returns table(id uuid,created_at timestamptz,source text,status text,qualification_status text,sender_name text,sender_email text,message text,contact_revealed boolean)
language plpgsql security definer set search_path='' as $$
declare reveal boolean;
begin
  if not ap_private.has_agency_role(target_agency,array['owner','admin','analyst']) then raise exception 'Agency lead access required'; end if;
  reveal := ap_private.has_active_paid_access(target_agency);
  return query select i.id,i.created_at,i.source,i.status,i.qualification_status,
    case when reveal then i.sender_name else 'Private lead' end,
    case when reveal then i.sender_email else null end,
    case when reveal then i.message else 'Contact details and original inquiry are available with an active Privé, Select, or Elite entitlement.' end,
    reveal
  from public.ap_inquiries i where i.agency_id=target_agency and i.status<>'spam' order by i.created_at desc limit 200;
end; $$;

create or replace function public.ap_agency_update_lead(target_agency uuid,target_inquiry uuid,next_status text,outcome_note text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not ap_private.has_agency_role(target_agency,array['owner','admin']) then raise exception 'Agency owner or administrator access required'; end if;
  if next_status not in ('delivered','accepted','declined','closed') then raise exception 'Invalid lead status'; end if;
  if length(trim(coalesce(outcome_note,'')))<10 then raise exception 'A traceable outcome note is required'; end if;
  update public.ap_inquiries set status=next_status,decision_note=concat_ws(E'\n',decision_note,'Agency outcome: '||trim(outcome_note)),updated_at=now() where id=target_inquiry and agency_id=target_agency;
  if not found then raise exception 'Lead not found'; end if;
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
  values(auth.uid(),target_agency,'lead.outcome_recorded','inquiry',target_inquiry::text,jsonb_build_object('status',next_status,'note',trim(outcome_note)));
end; $$;

create or replace function public.ap_agency_analytics(target_agency uuid,range_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; paid boolean; plan text;
begin
  if not ap_private.has_agency_role(target_agency,array['owner','admin','analyst']) then raise exception 'Agency analytics access required'; end if;
  range_days := greatest(7,least(range_days,365));
  paid := ap_private.has_active_paid_access(target_agency);
  select coalesce(s.plan_code,'free') into plan from public.ap_subscriptions s where s.agency_id=target_agency;
  plan := coalesce(plan,'free');
  select jsonb_build_object(
    'plan',plan,'paid_access',paid,'range_days',range_days,'timezone','Asia/Manila','freshness','Near real-time',
    'profile_views',count(*) filter(where event_type='profile_view'),
    'unique_visitors',count(distinct session_id) filter(where event_type='profile_view'),
    'search_appearances',count(*) filter(where event_type='directory_impression'),
    'contact_opens',case when paid then count(*) filter(where event_type='contact_open') else null end,
    'website_clicks',case when paid then count(*) filter(where event_type='website_click') else null end,
    'inquiries',(select count(*) from public.ap_inquiries i where i.agency_id=target_agency and i.created_at>=now()-(range_days||' days')::interval),
    'qualified_leads',case when paid then (select count(*) from public.ap_inquiries i where i.agency_id=target_agency and i.qualification_status='qualified' and i.created_at>=now()-(range_days||' days')::interval) else null end,
    'accepted_leads',case when paid then (select count(*) from public.ap_inquiries i where i.agency_id=target_agency and i.status in ('accepted','closed') and i.created_at>=now()-(range_days||' days')::interval) else null end,
    'sponsored_views',case when plan in ('select','elite') then count(*) filter(where event_type='profile_view' and source='sponsored') else null end
  ) into result from public.ap_marketplace_events e where e.agency_id=target_agency and e.occurred_at>=now()-(range_days||' days')::interval;
  return result;
end; $$;

revoke all on function public.ap_agency_lead_inbox(uuid) from public;grant execute on function public.ap_agency_lead_inbox(uuid) to authenticated;
revoke all on function public.ap_agency_update_lead(uuid,uuid,text,text) from public;grant execute on function public.ap_agency_update_lead(uuid,uuid,text,text) to authenticated;
revoke all on function public.ap_agency_analytics(uuid,integer) from public;grant execute on function public.ap_agency_analytics(uuid,integer) to authenticated;

commit;
