-- AP Fix 01 - Protect Subscription Trials and Manual Plan Decisions
-- Save in supabase/migrations/. Run once on the existing Avera Prive project.
-- Replaces two functions only; does not change existing subscription records.
begin;

create or replace function public.ap_start_prive_trial(target_agency uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  existing public.ap_subscriptions%rowtype;
  subscription_id uuid;
begin
  if auth.uid() is null or not ap_private.has_agency_role(target_agency, array['owner','admin','billing'])
     or exists (select 1 from public.ap_staff_roles r where r.user_id = auth.uid()) then
    raise exception 'Agency billing access required';
  end if;

  -- Use the same lock as PayPal and crypto activation, including before a row exists.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('subscription:' || target_agency::text));
  select s.* into existing from public.ap_subscriptions s
    where s.agency_id = target_agency for update;
  if existing.trial_started_at is not null then
    raise exception 'The 7-day Prive trial has already been used';
  end if;
  if existing.id is not null and (
    existing.plan_code <> 'free' or existing.status <> 'free'
    or existing.current_period_started_at is not null
    or existing.current_period_ends_at is not null
    or existing.commercial_reference is not null
  ) then
    raise exception 'The trial is available only before a paid subscription';
  end if;
  if not exists (select 1 from public.ap_plans p where p.code = 'prive' and p.active) then
    raise exception 'The Prive trial is currently unavailable';
  end if;

  insert into public.ap_subscriptions as saved
    (agency_id,plan_code,status,trial_started_at,trial_ends_at)
  values (target_agency,'prive','trialing',now(),now() + interval '7 days')
  on conflict (agency_id) do update
    set plan_code = 'prive', status = 'trialing', trial_started_at = now(),
        trial_ends_at = now() + interval '7 days', updated_at = now()
    where saved.plan_code = 'free' and saved.status = 'free'
      and saved.trial_started_at is null
      and saved.current_period_started_at is null
      and saved.current_period_ends_at is null
      and saved.commercial_reference is null
  returning id into subscription_id;
  if subscription_id is null then
    raise exception 'The trial is no longer available for this agency';
  end if;

  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
  values (auth.uid(),target_agency,'subscription.trial_started','subscription',subscription_id::text,
    jsonb_build_object('plan','prive','days',7,'card_required',false));
  return subscription_id;
end;
$$;

-- Keep the existing argument names: the application uses named RPC arguments.
create or replace function public.ap_decide_plan_request(
  request_id uuid, decision text, decision_note text, commercial_ref text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  p_request_id alias for $1;
  p_decision alias for $2;
  p_note alias for $3;
  p_commercial_ref alias for $4;
  v_agency uuid;
  v_plan text;
  v_subscription uuid;
begin
  if auth.uid() is null or not ap_private.is_staff(array['super_admin','finance']) then
    raise exception 'Subscription operations access required';
  end if;
  if coalesce(p_decision,'') not in ('approved','declined')
     or length(trim(coalesce(p_note,''))) < 10 then
    raise exception 'A valid decision and traceable note are required';
  end if;
  select r.agency_id into v_agency from public.ap_plan_change_requests r
    where r.id = p_request_id and r.status = 'pending';
  if v_agency is null then raise exception 'Pending request not found'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('subscription:' || v_agency::text));

  update public.ap_plan_change_requests as r
    set status = p_decision, decision_note = trim(p_note),
        decided_by = auth.uid(), decided_at = now()
    where r.id = p_request_id and r.status = 'pending'
    returning r.agency_id,r.requested_plan into v_agency,v_plan;
  if not found then raise exception 'Pending request not found'; end if;
  if p_decision = 'approved' then
    insert into public.ap_subscriptions
      (agency_id,plan_code,status,current_period_started_at,current_period_ends_at,commercial_reference,activated_by)
    values (v_agency,v_plan,'active',now(),now() + interval '1 month',
      nullif(trim(p_commercial_ref),''),auth.uid())
    on conflict (agency_id) do update
      set plan_code = excluded.plan_code, status = 'active',
          current_period_started_at = excluded.current_period_started_at,
          current_period_ends_at = excluded.current_period_ends_at,
          commercial_reference = excluded.commercial_reference,
          activated_by = excluded.activated_by, updated_at = now()
    returning id into v_subscription;
  end if;
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
  values (auth.uid(),v_agency,'subscription.plan_decided','plan_change_request',p_request_id::text,
    jsonb_build_object('decision',p_decision,'plan',v_plan,'note',trim(p_note),'subscription_id',v_subscription));
end;
$$;

revoke all on function public.ap_start_prive_trial(uuid),
  public.ap_decide_plan_request(uuid,text,text,text) from public,anon;
grant execute on function public.ap_start_prive_trial(uuid),
  public.ap_decide_plan_request(uuid,text,text,text) to authenticated,service_role;

commit;
