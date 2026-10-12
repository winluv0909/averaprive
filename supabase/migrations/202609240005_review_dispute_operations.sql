begin;

-- Completes the operational side of review responses, reports, and disputes.
-- Trust decisions remain independent from billing, placement, and verification.

create table if not exists public.ap_report_decisions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.ap_reports(id) on delete cascade,
  decision text not null check (decision in ('action_taken','dismissed')),
  reason text not null check (length(trim(reason)) between 20 and 5000),
  decided_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.ap_report_decisions enable row level security;
drop policy if exists "report_decisions_related_read" on public.ap_report_decisions;
create policy "report_decisions_related_read" on public.ap_report_decisions for select to authenticated
using (
  exists (
    select 1 from public.ap_reports report
    where report.id = report_id
      and (
        report.reporter_id = auth.uid()
        or ap_private.has_agency_role(report.agency_id,array['owner','admin'])
        or ap_private.is_staff(array['super_admin','moderator','support'])
      )
  )
);
revoke all on public.ap_report_decisions from anon, authenticated;
grant select on public.ap_report_decisions to authenticated;

create or replace function public.ap_moderate_review_response(
  target_response uuid, decision text, reviewer_reason text
)
returns void language plpgsql security definer set search_path = '' as $$
declare target_agency uuid;
begin
  if not ap_private.is_staff(array['super_admin','moderator']) then
    raise exception 'Moderator access required';
  end if;
  if decision not in ('publish','reject','hide') then raise exception 'Invalid response decision'; end if;
  if length(trim(coalesce(reviewer_reason,''))) < 20 then
    raise exception 'A meaningful moderation reason is required';
  end if;

  update public.ap_review_responses set
    status=case decision when 'publish' then 'published' when 'reject' then 'rejected' else 'hidden' end,
    moderator_id=auth.uid(), moderation_reason=trim(reviewer_reason),
    published_at=case when decision='publish' then now() else published_at end,
    updated_at=now()
  where id=target_response and status in ('pending','published')
  returning agency_id into target_agency;
  if target_agency is null then raise exception 'Eligible response not found'; end if;

  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
  values(auth.uid(),target_agency,'review_response.moderation_decision','review_response',target_response::text,
    jsonb_build_object('decision',decision));
end;
$$;

create or replace function public.ap_decide_report(
  target_report uuid, decision text, decision_reason text
)
returns void language plpgsql security definer set search_path = '' as $$
declare target_agency uuid;
begin
  if not ap_private.is_staff(array['super_admin','moderator','support']) then
    raise exception 'Trust staff access required';
  end if;
  if decision not in ('action_taken','dismissed') then raise exception 'Invalid report decision'; end if;
  if length(trim(coalesce(decision_reason,''))) < 20 then
    raise exception 'A meaningful evidence-based reason is required';
  end if;
  select agency_id into target_agency from public.ap_reports where id=target_report;
  if target_agency is null then raise exception 'Report not found'; end if;

  insert into public.ap_report_decisions(report_id,decision,reason,decided_by)
  values(target_report,decision,trim(decision_reason),auth.uid());
  update public.ap_moderation_cases set status='resolved',assigned_to=auth.uid(),
    resolution_summary=trim(decision_reason),resolved_at=now(),updated_at=now()
  where agency_id=target_agency and case_type='dispute' and status in ('open','in_review');
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
  values(auth.uid(),target_agency,'report.decision','report',target_report::text,
    jsonb_build_object('decision',decision));
end;
$$;

create or replace function public.ap_resolve_dispute(
  target_dispute uuid, decision text, decision_reason text
)
returns void language plpgsql security definer set search_path = '' as $$
declare target_agency uuid;
begin
  if not ap_private.is_staff(array['super_admin','moderator','support']) then
    raise exception 'Trust staff access required';
  end if;
  if decision not in ('upheld','denied') then raise exception 'Invalid dispute decision'; end if;
  if length(trim(coalesce(decision_reason,''))) < 20 then
    raise exception 'A meaningful evidence-based reason is required';
  end if;

  update public.ap_disputes set status=decision,assigned_to=auth.uid(),
    resolution=trim(decision_reason),resolved_at=now(),updated_at=now()
  where id=target_dispute and status in ('open','investigating')
  returning agency_id into target_agency;
  if target_agency is null then raise exception 'Eligible dispute not found'; end if;

  update public.ap_moderation_cases set status='resolved',assigned_to=auth.uid(),
    resolution_summary=trim(decision_reason),resolved_at=now(),updated_at=now()
  where agency_id=target_agency and case_type='dispute' and status in ('open','in_review');
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
  values(auth.uid(),target_agency,'dispute.decision','dispute',target_dispute::text,
    jsonb_build_object('decision',decision));
end;
$$;

revoke all on function public.ap_moderate_review_response(uuid,text,text) from public;
revoke all on function public.ap_decide_report(uuid,text,text) from public;
revoke all on function public.ap_resolve_dispute(uuid,text,text) from public;
grant execute on function public.ap_moderate_review_response(uuid,text,text) to authenticated;
grant execute on function public.ap_decide_report(uuid,text,text) to authenticated;
grant execute on function public.ap_resolve_dispute(uuid,text,text) to authenticated;

commit;
