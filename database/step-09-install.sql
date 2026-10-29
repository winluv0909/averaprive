begin;
-- Optional directory telemetry must not be collected as an essential event.
create or replace function public.ap_record_marketplace_event(target_agency uuid,event_name text,visitor_session text,event_page text,event_source text default 'organic',analytics_consent boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 if analytics_consent is distinct from true then return; end if;
 if event_name is null or event_name not in ('directory_impression','profile_view','contact_open','website_click') then raise exception 'Invalid public event'; end if;
 if visitor_session is null or visitor_session !~ '^[a-zA-Z0-9_-]{16,80}$' then raise exception 'Invalid session'; end if;
 if not exists(select 1 from public.ap_agencies where id=target_agency and published and not demo_profile) then return; end if;
 perform pg_advisory_xact_lock(hashtextextended('analytics:'||target_agency::text||':'||event_name||':'||visitor_session,0));
 if exists(select 1 from public.ap_marketplace_events where agency_id=target_agency and event_type=event_name and session_id=visitor_session and occurred_at>now()-interval '30 minutes') then return; end if;
 insert into public.ap_marketplace_events(agency_id,event_type,session_id,page_path,source,consent_state)
 values(target_agency,event_name,visitor_session,left(coalesce(event_page,'/'),200),case when event_source in ('organic','sponsored','direct','search') then event_source else 'organic' end,'analytics');
end; $$;
revoke all on function public.ap_record_marketplace_event(uuid,text,text,text,text,boolean) from public;
grant execute on function public.ap_record_marketplace_event(uuid,text,text,text,text,boolean) to anon,authenticated;
-- Retired checkout controls have no callers in the active app. Keep their records,
-- but remove client execution to prevent old APIs changing current wallet invoices.
do $$
declare signature text;
begin
 foreach signature in array array['public.ap_resolve_crypto_payment_exception(uuid,text,text)','public.ap_assign_shared_crypto_deposit(text,text,uuid,text)','public.ap_submit_crypto_transaction_hash(uuid,text)'] loop
  if to_regprocedure(signature) is not null then
   execute format('revoke execute on function %s from public,anon,authenticated',to_regprocedure(signature));
  end if;
 end loop;
end; $$;
commit;
