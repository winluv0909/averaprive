-- AP Security 05 — Restrict Private Function Execution
begin;

do $$
declare
  signature text;
  target regprocedure;
  trigger_only boolean;
  checked integer := 0;
  targets text[] := array[
    'public.ap_agency_analytics(uuid,integer)',
    'public.ap_agency_lead_inbox(uuid)',
    'public.ap_agency_team(uuid)',
    'public.ap_agency_update_lead(uuid,uuid,text,text)',
    'public.ap_cancel_agency_invitation(uuid,uuid)',
    'public.ap_create_agency_draft(text,text)',
    'public.ap_create_fraud_investigation(uuid,uuid,text,text,text,text,text,jsonb)',
    'public.ap_create_sponsored_placement(uuid,text,text,timestamp with time zone,timestamp with time zone,text,text)',
    'public.ap_create_user_profile()',
    'public.ap_decide_plan_request(uuid,text,text,text)',
    'public.ap_decide_report(uuid,text,text)',
    'public.ap_detect_review_risk()',
    'public.ap_invite_agency_member(uuid,text,text)',
    'public.ap_manage_agency_member(uuid,uuid,text,text)',
    'public.ap_moderate_review(uuid,text,text,boolean)',
    'public.ap_moderate_review_response(uuid,text,text)',
    'public.ap_open_dispute(uuid,text,jsonb)',
    'public.ap_publish_agency(uuid)',
    'public.ap_request_plan_change(uuid,text)',
    'public.ap_resolve_dispute(uuid,text,text)',
    'public.ap_resolve_fraud_investigation(uuid,text,text)',
    'public.ap_review_agency_submission(uuid,text,text)',
    'public.ap_review_verification_request(uuid,text,text,jsonb)',
    'public.ap_save_editorial_post(uuid,text,text,text,text,text,text,text[],text,text,text,text,text,text,text,text,timestamp with time zone)',
    'public.ap_start_prive_trial(uuid)',
    'public.ap_submit_agency_for_review(uuid)',
    'public.ap_submit_agency_response(uuid,text)',
    'public.ap_submit_report(uuid,uuid,text,text,jsonb)',
    'public.ap_submit_review(uuid,smallint,text,jsonb)',
    'public.ap_submit_verification_request(uuid,jsonb)',
    'public.ap_update_inquiry(uuid,text,text,text)',
    'public.ap_update_sponsored_placement_status(uuid,text,text)'
  ];
begin
  foreach signature in array targets
  loop
    target := to_regprocedure(signature);

    if target is null then
      raise exception 'Expected function missing: %', signature;
    end if;

    trigger_only := signature in (
      'public.ap_create_user_profile()',
      'public.ap_detect_review_risk()'
    );

    if not exists (
      select 1 from pg_proc p
      where p.oid = target
        and p.prosecdef
        and (p.prorettype = 'pg_catalog.trigger'::regtype)
            = trigger_only
    ) then
      raise exception 'Unexpected function definition: %', signature;
    end if;

    execute format(
      'grant execute on function %s to service_role', target
    );

    if not trigger_only then
      execute format(
        'grant execute on function %s to authenticated', target
      );
    end if;

    execute format(
      'revoke execute on function %s from public, anon', target
    );

    if trigger_only then
      execute format(
        'revoke execute on function %s from authenticated', target
      );
    end if;

    if has_function_privilege('anon', target, 'EXECUTE') then
      raise exception 'Anonymous execution remains: %', signature;
    end if;

    if has_function_privilege(
      'authenticated', target, 'EXECUTE'
    ) is distinct from (not trigger_only) then
      raise exception 'Unexpected signed-in access: %', signature;
    end if;

    if not has_function_privilege(
      'service_role', target, 'EXECUTE'
    ) then
      raise exception 'Server execution missing: %', signature;
    end if;

    checked := checked + 1;
  end loop;

  if checked <> 32 then
    raise exception 'Expected 32 functions; checked %', checked;
  end if;

  if not has_function_privilege(
    'anon',
    'public.ap_submit_inquiry(uuid,text,text,text,text,text,boolean)',
    'EXECUTE'
  ) or not has_function_privilege(
    'anon',
    'public.ap_record_marketplace_event(uuid,text,text,text,text,boolean)',
    'EXECUTE'
  ) then
    raise exception 'Public entry-point access is missing';
  end if;
end;
$$;

commit;