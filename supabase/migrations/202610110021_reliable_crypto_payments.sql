begin;
alter table public.ap_plans add column if not exists annual_price_usd numeric(12,2);
-- Every address remains reserved for its invoice, including after expiry.
-- This deliberately prevents a late transfer from paying an unrelated order.
alter table public.ap_payment_orders add column if not exists checkout_request_id uuid;
create unique index if not exists ap_crypto_checkout_request_unique on public.ap_payment_orders(checkout_request_id) where checkout_request_id is not null;
alter table public.ap_payment_orders add column if not exists token_contract text;
alter table public.ap_payment_orders add column if not exists token_decimals integer;
alter table public.ap_payment_orders add column if not exists scan_cursor text;
alter table public.ap_payment_orders add column if not exists monitor_after timestamptz not null default now();
alter table public.ap_payment_orders add column if not exists monitor_lock_until timestamptz;
alter table public.ap_payment_orders add column if not exists monitor_worker uuid;
alter table public.ap_payment_orders add column if not exists monitor_error text;
alter table public.ap_payment_orders add column if not exists submitted_txid text;
alter table public.ap_payment_orders add column if not exists last_monitored_at timestamptz;
-- Customer hints must not reserve a TXID or constitute payment evidence.
drop index if exists public.ap_payment_orders_transaction_hash_uq;
create table if not exists public.ap_crypto_address_leases (
  network text not null, address text not null, order_id uuid not null unique references public.ap_payment_orders(id),
  created_at timestamptz not null default now(), primary key(network,address)
);
create unique index if not exists ap_crypto_address_never_reuse on public.ap_crypto_address_leases(address);
create table if not exists public.ap_crypto_tx_claims (
  network text not null, txid text not null, order_id uuid not null references public.ap_payment_orders(id),
  created_at timestamptz not null default now(), primary key(network,txid)
);
create table if not exists public.ap_crypto_observations (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.ap_payment_orders(id),
  evidence jsonb not null, state text not null, created_at timestamptz not null default now()
);
create table if not exists public.ap_payment_exceptions (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.ap_payment_orders(id),
  code text not null, txid text not null default '', details jsonb not null default '{}',
  reviewed_by uuid references auth.users(id), review_note text, reviewed_at timestamptz,
  created_at timestamptz not null default now(), unique(order_id,code,txid)
);
create table if not exists public.ap_payment_notifications (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.ap_payment_orders(id),
  kind text not null, recipient text, event text not null, attempts integer not null default 0,
  status text not null default 'pending' check(status in ('pending','sending','sent')),
  retry_after timestamptz not null default now(), locked_until timestamptz, last_error text,
  sent_at timestamptz, created_at timestamptz not null default now(), unique(order_id,kind,event)
);
alter table public.ap_crypto_address_leases enable row level security;
alter table public.ap_crypto_tx_claims enable row level security;
alter table public.ap_crypto_observations enable row level security;
alter table public.ap_payment_exceptions enable row level security;
alter table public.ap_payment_notifications enable row level security;
revoke all on public.ap_crypto_address_leases,public.ap_crypto_tx_claims,public.ap_crypto_observations,public.ap_payment_exceptions,public.ap_payment_notifications from anon,authenticated;
grant all on public.ap_payment_orders,public.ap_billing_profiles,public.ap_invoices,public.ap_payment_events to service_role;
grant usage,select on sequence public.ap_invoice_number_seq to service_role;
grant all on public.ap_crypto_address_leases,public.ap_crypto_tx_claims,public.ap_crypto_observations,public.ap_payment_exceptions,public.ap_payment_notifications to service_role;

create or replace function public.ap_create_reliable_crypto_invoice(input jsonb, addresses jsonb, seller jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare chosen text; payment_id uuid := gen_random_uuid(); invoice_id uuid; invoice_number text; net text := input->>'crypto_network'; candidate text; existing_order public.ap_payment_orders%rowtype;
begin
  if input->>'checkout_request_id' is null then raise exception 'Checkout request ID required'; end if;
  perform pg_advisory_xact_lock(hashtext('crypto-checkout:'||(input->>'checkout_request_id')));
  select * into existing_order from public.ap_payment_orders where checkout_request_id=(input->>'checkout_request_id')::uuid;
  if existing_order.id is not null then
    if existing_order.agency_id is distinct from (input->>'agency_id')::uuid or existing_order.created_by is distinct from (input->>'created_by')::uuid
      or existing_order.plan_code is distinct from input->>'plan_code' or existing_order.billing_cycle is distinct from input->>'billing_cycle'
      or existing_order.crypto_asset is distinct from input->>'crypto_asset' or existing_order.crypto_network is distinct from net
      or existing_order.total_amount is distinct from (input->>'total_amount')::numeric then raise exception 'Checkout request already used for different details'; end if;
    select id,ap_invoices.invoice_number into invoice_id,invoice_number from public.ap_invoices where order_id=existing_order.id;
    return jsonb_build_object('order_id',existing_order.id,'invoice_id',invoice_id,'invoice_number',invoice_number,'address',existing_order.receiving_address);
  end if;
  if net not in ('BEP20','ERC20','TRC20','SOL') or input->>'crypto_asset' not in ('USDT','USDC','BTC')
    or input->>'billing_cycle' not in ('monthly','annual') or input->>'plan_code' not in ('prive','select','elite')
    or coalesce((input->>'total_amount')::numeric,0)<=0 or coalesce((input->>'expected_crypto_amount')::numeric,0)<=0
    or coalesce(input->>'token_contract','')='' or (input->>'payment_expires_at')::timestamptz<=now()
    or coalesce((input->>'token_decimals')::integer,-1) not between 0 and 18
    or coalesce((input->>'required_confirmations')::integer,0)<1 then raise exception 'Invalid payment invoice'; end if;
  perform pg_advisory_xact_lock(hashtext('crypto-wallet-pool:'||net));
  for candidate in select jsonb_array_elements_text(addresses) loop
    candidate := case when net in ('BEP20','ERC20') then lower(candidate) else candidate end;
    if candidate<>'' and not exists(select 1 from public.ap_crypto_address_leases where address=candidate) then chosen:=candidate; exit; end if;
  end loop;
  if chosen is null then raise exception 'Receiving address pool is exhausted. Add unused receiving addresses before accepting another payment.'; end if;
  insert into public.ap_billing_profiles(agency_id,contact_full_name,legal_name,billing_email,billing_address,tax_id,country_code)
    values((input->>'agency_id')::uuid,input->>'payer_full_name',input->>'payer_company_name',input->>'payer_email',input->>'payer_billing_address',nullif(input->>'tax_id',''),coalesce(input->>'country_code','PH'))
    on conflict(agency_id) do update set contact_full_name=excluded.contact_full_name,legal_name=excluded.legal_name,billing_email=excluded.billing_email,billing_address=excluded.billing_address,tax_id=excluded.tax_id,updated_at=now();
  insert into public.ap_payment_orders(id,checkout_request_id,agency_id,plan_code,billing_cycle,provider,currency,subtotal,total_amount,created_by,payer_full_name,payer_email,payer_company_name,payer_billing_address,crypto_asset,crypto_network,receiving_address,expected_crypto_amount,required_confirmations,payment_expires_at,token_contract,token_decimals,scan_cursor)
    values(payment_id,(input->>'checkout_request_id')::uuid,(input->>'agency_id')::uuid,input->>'plan_code',input->>'billing_cycle','crypto','USD',(input->>'total_amount')::numeric,(input->>'total_amount')::numeric,(input->>'created_by')::uuid,input->>'payer_full_name',input->>'payer_email',input->>'payer_company_name',input->>'payer_billing_address',input->>'crypto_asset',net,chosen,(input->>'expected_crypto_amount')::numeric,(input->>'required_confirmations')::integer,(input->>'payment_expires_at')::timestamptz,input->>'token_contract',(input->>'token_decimals')::integer,input->>'scan_cursor');
  insert into public.ap_crypto_address_leases(network,address,order_id) values(net,chosen,payment_id);
  insert into public.ap_invoices(order_id,agency_id,currency,subtotal,total_amount,due_at,seller_snapshot,customer_snapshot,line_items,payment_snapshot,notes)
    values(payment_id,(input->>'agency_id')::uuid,'USD',(input->>'total_amount')::numeric,(input->>'total_amount')::numeric,(input->>'payment_expires_at')::timestamptz,seller,
    jsonb_build_object('full_name',input->>'payer_full_name','legal_name',input->>'payer_company_name','billing_email',input->>'payer_email','billing_address',input->>'payer_billing_address','tax_id',input->>'tax_id'),
    jsonb_build_array(jsonb_build_object('description',(input->>'plan_name')||' - '||(input->>'billing_cycle'),'quantity',1,'unit_price',(input->>'total_amount')::numeric,'amount',(input->>'total_amount')::numeric)),
    jsonb_build_object('asset',input->>'crypto_asset','network',net,'receiving_address',chosen,'expected_crypto_amount',input->>'expected_crypto_amount','token_contract',input->>'token_contract','expires_at',input->>'payment_expires_at','required_confirmations',input->>'required_confirmations','quoted_at',input->>'quoted_at','usd_rate',input->>'usd_rate','rate_source',input->>'rate_source','status','awaiting_payment'),
    'Payment purchases subscription tools only. Verification and reviews remain independent.') returning id,ap_invoices.invoice_number into invoice_id,invoice_number;
  update public.ap_payment_orders set provider_reference=invoice_number,checkout_url='/agency/dashboard/agencies/'||(input->>'agency_id')||'/billing/payments/'||payment_id::text where id=payment_id;
  return jsonb_build_object('order_id',payment_id,'invoice_id',invoice_id,'invoice_number',invoice_number,'address',chosen);
end; $$;

create or replace function public.ap_claim_crypto_monitor(worker uuid, batch_size integer default 10)
returns setof jsonb language plpgsql security definer set search_path='' as $$
begin
  return query with picked as (
    select id from public.ap_payment_orders where provider='crypto' and status='pending' and token_contract is not null
      and monitor_after<=now() and (monitor_lock_until is null or monitor_lock_until<now())
      order by monitor_after,created_at for update skip locked limit greatest(1,least(batch_size,20))
  ) update public.ap_payment_orders p set monitor_worker=worker,monitor_lock_until=now()+interval '10 minutes' from picked where p.id=picked.id returning to_jsonb(p)||jsonb_build_object('expected_crypto_amount',p.expected_crypto_amount::text);
end; $$;

create or replace function public.ap_record_crypto_evidence(target_order uuid, worker uuid, evidence jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare p public.ap_payment_orders%rowtype; state text; hash text; net text; actual numeric; seen timestamptz; claimed uuid; old_state text; hint boolean := coalesce((evidence->>'hint_only')::boolean,false);
begin
  select * into p from public.ap_payment_orders where id=target_order for update;
  if p.id is null or p.monitor_worker is distinct from worker or p.monitor_lock_until<now() then raise exception 'Monitor lease lost'; end if;
  if p.status<>'pending' then return p.current_crypto_status; end if;
  net:=evidence->>'network'; hash:=evidence->>'txid';
  if net in ('BEP20','ERC20','TRC20') then hash:=lower(hash); end if;
  if coalesce(hash,'')='' then raise exception 'Verified blockchain TXID required'; end if;
  actual:=(evidence->>'amount')::numeric; seen:=(evidence->>'transaction_at')::timestamptz;
  if actual<0 or actual is null or seen is null then raise exception 'Incomplete blockchain evidence'; end if;
  old_state:=p.current_crypto_status;
  state:=case
    when net is distinct from p.crypto_network then 'wrong_network'
    when evidence->>'destination' is distinct from p.receiving_address then 'wrong_destination'
    when evidence->>'token' is distinct from p.token_contract then 'wrong_token'
    when coalesce((evidence->>'successful')::boolean,false)=false then 'failed_on_chain'
    when seen<p.created_at-interval '2 minutes' then 'manual_review'
    when seen>p.payment_expires_at then 'late_payment'
    when actual<p.expected_crypto_amount then 'underpaid'
    when actual>p.expected_crypto_amount then 'overpaid'
    when coalesce((evidence->>'confirmations')::integer,0)=0 then 'detected'
    when coalesce((evidence->>'confirmations')::integer,0)<p.required_confirmations or coalesce((evidence->>'finalized')::boolean,false)=false then 'confirming'
    else 'confirmed' end;
  select order_id into claimed from public.ap_crypto_tx_claims where network=net and txid=hash;
  if claimed is not null and claimed<>p.id then state:='duplicate_txid'; end if;
  -- TXID claims come from independent blockchain evidence, never from a customer hint.
  if state in ('detected','confirming','confirmed','underpaid','overpaid','late_payment') then
    insert into public.ap_crypto_tx_claims(network,txid,order_id) values(net,hash,p.id) on conflict do nothing;
    select order_id into claimed from public.ap_crypto_tx_claims where network=net and txid=hash;
    if claimed<>p.id then state:='duplicate_txid'; end if;
  end if;
  insert into public.ap_crypto_observations(order_id,evidence,state) values(p.id,evidence,state);
  if state not in ('detected','confirming','confirmed') then
    insert into public.ap_payment_exceptions(order_id,code,txid,details) values(p.id,state,hash,evidence) on conflict do nothing;
    insert into public.ap_payment_notifications(order_id,kind,event) values(p.id,'admin',state) on conflict do nothing;
  end if;
  -- An unrelated customer hint is logged for support without blocking real payment.
  if hint and state in ('wrong_destination','wrong_network','duplicate_txid','manual_review') then return old_state; end if;
  -- Exceptions require review; a second payment must not silently override them.
  if old_state in ('underpaid','overpaid','late_payment','duplicate_txid','manual_review') then return old_state; end if;
  if state='confirmed' then
    update public.ap_payment_orders set current_crypto_status='confirming',verified_transaction_hash=hash,blockchain_confirmations=(evidence->>'confirmations')::integer,transaction_detected_at=coalesce(transaction_detected_at,now()),updated_at=now() where id=p.id;
    -- Activation checks this independent evidence again and runs in the same transaction.
    perform public.ap_activate_crypto_payment(p.id,hash,(evidence->>'confirmations')::integer);
    return 'confirmed';
  end if;
  if state in ('detected','confirming') then
    if p.transaction_detected_at is null then
      insert into public.ap_crypto_observations(order_id,evidence,state) values(p.id,evidence,'detected');
      insert into public.ap_payment_notifications(order_id,kind,event) values(p.id,'admin','detected') on conflict do nothing;
    end if;
    update public.ap_payment_orders set current_crypto_status=state,verified_transaction_hash=hash,blockchain_confirmations=greatest(0,(evidence->>'confirmations')::integer),transaction_detected_at=coalesce(transaction_detected_at,now()),updated_at=now() where id=p.id;
  else
    update public.ap_payment_orders set current_crypto_status=state,transaction_detected_at=coalesce(transaction_detected_at,now()),updated_at=now() where id=p.id;
  end if;
  return state;
end; $$;

-- Replace the old activation function: never inflate a confirmation count.
create or replace function public.ap_activate_crypto_payment(target_order uuid, verified_txid text, confirmations integer)
returns void language plpgsql security definer set search_path='' as $$
declare p public.ap_payment_orders%rowtype; proof jsonb; invoice_id uuid; existing public.ap_subscriptions%rowtype; started timestamptz;
begin
  select * into p from public.ap_payment_orders where id=target_order for update;
  if p.id is null then raise exception 'Payment order not found'; end if;
  if p.status='paid' then return; end if;
  if p.status<>'pending' or p.provider<>'crypto' then raise exception 'Payment cannot be activated'; end if;
  select evidence into proof from public.ap_crypto_observations where order_id=p.id and state='confirmed' and evidence->>'txid'=verified_txid order by created_at desc limit 1;
  if p.current_crypto_status<>'confirming' or p.verified_transaction_hash is distinct from verified_txid or proof is null or not coalesce((proof->>'successful')::boolean,false) or not coalesce((proof->>'finalized')::boolean,false)
    or coalesce((proof->>'confirmations')::integer,0)<p.required_confirmations or confirmations<p.required_confirmations or confirmations is distinct from (proof->>'confirmations')::integer
    or proof->>'token' is distinct from p.token_contract or proof->>'network' is distinct from p.crypto_network
    or proof->>'destination' is distinct from p.receiving_address or (proof->>'amount')::numeric<>p.expected_crypto_amount
    or (proof->>'transaction_at')::timestamptz>p.payment_expires_at or (proof->>'transaction_at')::timestamptz<p.created_at-interval '2 minutes'
    or not exists(select 1 from public.ap_crypto_tx_claims where network=p.crypto_network and txid=verified_txid and order_id=p.id)
    then raise exception 'Independent finalized blockchain evidence required'; end if;
  perform pg_advisory_xact_lock(hashtext('subscription:'||p.agency_id::text));
  select * into existing from public.ap_subscriptions where agency_id=p.agency_id for update;
  started:=case when existing.plan_code=p.plan_code and existing.status='active' and existing.current_period_ends_at>now() then existing.current_period_ends_at else now() end;
  select id into invoice_id from public.ap_invoices where order_id=p.id;
  if invoice_id is null then raise exception 'Invoice missing'; end if;
  update public.ap_payment_orders set status='paid',current_crypto_status='confirmed',verified_transaction_hash=verified_txid,
    blockchain_confirmations=confirmations,transaction_detected_at=coalesce(transaction_detected_at,now()),transaction_confirmed_at=now(),updated_at=now() where id=p.id;
  update public.ap_invoices set status='paid',paid_at=now(),payment_snapshot=payment_snapshot||proof||jsonb_build_object('status','confirmed','reference',p.id,'verified_transaction_hash',verified_txid),updated_at=now() where id=invoice_id;
  insert into public.ap_subscriptions(agency_id,plan_code,status,current_period_started_at,current_period_ends_at,commercial_reference,cancel_at_period_end,updated_at)
    values(p.agency_id,p.plan_code,'active',now(),started+case when p.billing_cycle='annual' then interval '1 year' else interval '1 month' end,p.provider_reference,false,now())
    on conflict(agency_id) do update set plan_code=excluded.plan_code,status='active',current_period_started_at=excluded.current_period_started_at,current_period_ends_at=excluded.current_period_ends_at,commercial_reference=excluded.commercial_reference,cancel_at_period_end=false,updated_at=now();
  insert into public.ap_payment_notifications(order_id,kind,recipient,event) values(p.id,'customer',p.payer_email,'confirmed') on conflict do nothing;
  insert into public.ap_payment_notifications(order_id,kind,event) values(p.id,'admin','confirmed') on conflict do nothing;
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata) values(null,p.agency_id,'payment.blockchain_confirmed','payment',p.id::text,proof);
end; $$;

create or replace function public.ap_finish_crypto_monitor(target_order uuid, worker uuid, next_cursor text, error_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare p public.ap_payment_orders%rowtype;
begin
  select * into p from public.ap_payment_orders where id=target_order for update;
  if p.monitor_worker is distinct from worker then return; end if;
  if error_note is null and p.status='pending' and p.current_crypto_status='awaiting_payment' and p.payment_expires_at<now() then
    update public.ap_payment_orders set current_crypto_status='expired' where id=p.id;
    update public.ap_invoices set status='overdue',updated_at=now() where order_id=p.id and status='open';
    insert into public.ap_payment_exceptions(order_id,code) values(p.id,'expired') on conflict do nothing;
    insert into public.ap_payment_notifications(order_id,kind,event) values(p.id,'admin','expired') on conflict do nothing;
  end if;
  update public.ap_payment_orders set scan_cursor=case when error_note is null then coalesce(next_cursor,scan_cursor) else scan_cursor end,
    monitor_error=left(error_note,400),last_monitored_at=now(),monitor_after=now()+case when error_note is null then interval '30 seconds' else interval '2 minutes' end,
    monitor_worker=null,monitor_lock_until=null where id=p.id;
  if error_note is not null then
    insert into public.ap_payment_notifications(order_id,kind,event) values(p.id,'admin','monitor_error') on conflict do nothing;
  end if;
end; $$;

create or replace function public.ap_claim_payment_notifications(batch_size integer default 10)
returns setof public.ap_payment_notifications language plpgsql security definer set search_path='' as $$
begin
  return query with picked as(select id from public.ap_payment_notifications where status<>'sent' and retry_after<=now() and (locked_until is null or locked_until<now()) order by created_at for update skip locked limit greatest(1,least(batch_size,20)))
    update public.ap_payment_notifications p set status='sending',locked_until=now()+interval '5 minutes',attempts=attempts+1 from picked where p.id=picked.id returning p.*;
end; $$;
create or replace function public.ap_review_payment_exception(exception_id uuid, note text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not ap_private.is_staff(array['super_admin','finance']) then raise exception 'Finance access required'; end if;
  if length(trim(note))<10 then raise exception 'Record a meaningful review note'; end if;
  update public.ap_payment_exceptions set reviewed_by=auth.uid(),review_note=trim(note),reviewed_at=now() where id=exception_id;
  insert into public.ap_security_audit(actor_user_id,action,target_type,target_id,metadata) values(auth.uid(),'payment.exception_reviewed','payment_exception',exception_id::text,jsonb_build_object('note',trim(note)));
end; $$;
revoke all on function public.ap_create_reliable_crypto_invoice(jsonb,jsonb,jsonb),public.ap_claim_crypto_monitor(uuid,integer),public.ap_record_crypto_evidence(uuid,uuid,jsonb),public.ap_finish_crypto_monitor(uuid,uuid,text,text),public.ap_claim_payment_notifications(integer),public.ap_activate_crypto_payment(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.ap_create_reliable_crypto_invoice(jsonb,jsonb,jsonb),public.ap_claim_crypto_monitor(uuid,integer),public.ap_record_crypto_evidence(uuid,uuid,jsonb),public.ap_finish_crypto_monitor(uuid,uuid,text,text),public.ap_claim_payment_notifications(integer),public.ap_activate_crypto_payment(uuid,text,integer) to service_role;
revoke all on function public.ap_review_payment_exception(uuid,text) from public,anon;
grant execute on function public.ap_review_payment_exception(uuid,text) to authenticated;
-- Expired invoices stay pending at order level so late deposits remain detectable.
commit;
