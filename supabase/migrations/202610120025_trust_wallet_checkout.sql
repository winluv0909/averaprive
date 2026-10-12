begin;
-- Requires migrations 017, 021, 022, 023 and 024. Historical payments are retained.
alter table public.ap_payment_orders add column if not exists wallet_generation text;
create unique index if not exists ap_trust_wallet_unique_amount on public.ap_payment_orders(crypto_network,receiving_address,token_contract,expected_crypto_amount) where wallet_generation='trust_wallet_v1';
create table if not exists public.ap_trust_wallet_channels(asset text,network text,token text,address text,decimals integer,confirmations integer,primary key(asset,network));
alter table public.ap_trust_wallet_channels enable row level security;
revoke all on public.ap_trust_wallet_channels from public,anon,authenticated;
grant select on public.ap_trust_wallet_channels to service_role;
insert into public.ap_trust_wallet_channels values
 ('USDT','ERC20','0xdac17f958d2ee523a2206206994597c13d831ec7','0x7a71cfbdc7d37d9520445bff3634cbda889f904d',6,12),
 ('USDT','TRC20','TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t','TQmrKedVwf3yfvmLUcsPbnWsWHFkSFVZnq',6,20),
 ('USDT','BEP20','0x55d398326f99059ff775485246999027b3197955','0x7a71cfbdc7d37d9520445bff3634cbda889f904d',18,12),
 ('USDC','ARBITRUM','0xaf88d065e77c8cc2239327c5edb3a432268e5831','0x7a71cfbdc7d37d9520445bff3634cbda889f904d',6,12),
 ('USDC','ERC20','0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48','0x7a71cfbdc7d37d9520445bff3634cbda889f904d',6,12),
 ('USDC','BASE','0x833589fcd6edb6e08f4c7c32d4f71b54bda02913','0x7a71cfbdc7d37d9520445bff3634cbda889f904d',6,12),
 ('BTC','BITCOIN','BTC','bc1qyxpxwhmd8w39xndgnvu9wfq6d57sa7t7u9c42h',8,6)
on conflict(asset,network) do nothing;
create or replace function public.ap_create_trust_wallet_invoice(input jsonb, addresses jsonb, seller jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare chosen text; payment_id uuid := gen_random_uuid(); invoice_id uuid; invoice_number text; net text := input->>'crypto_network'; candidate text; price numeric; plan public.ap_plans%rowtype; base_amount numeric; allocated numeric; step numeric; adjustment numeric; existing_order public.ap_payment_orders%rowtype;
begin
  if not exists(select 1 from public.ap_agency_memberships m where m.agency_id=(input->>'agency_id')::uuid and m.user_id=(input->>'created_by')::uuid and m.status='active' and m.role in ('owner','admin','billing'))
    or exists(select 1 from public.ap_staff_roles where user_id=(input->>'created_by')::uuid) then raise exception 'Agency billing membership required'; end if;
  if length(coalesce(input->>'payer_company_name','')) not between 2 and 200 or length(coalesce(input->>'payer_billing_address','')) not between 8 and 1000
    or coalesce(input->>'payer_email','') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Complete billing information'; end if;
  select * into plan from public.ap_plans where code=input->>'plan_code' and active;
  if plan.code is null then raise exception 'Plan unavailable'; end if;
  price:=case when input->>'billing_cycle'='annual' then plan.annual_price_usd else plan.monthly_price_usd end;
  if price is null or price<=0 or price is distinct from (input->>'total_amount')::numeric then raise exception 'Authoritative plan price mismatch'; end if;
  if not exists(select 1 from public.ap_trust_wallet_channels c where c.asset=input->>'crypto_asset' and c.network=net and c.token=input->>'token_contract' and c.decimals=(input->>'token_decimals')::int and c.confirmations=(input->>'required_confirmations')::int
    and addresses=jsonb_build_array(c.address)) then raise exception 'Token, network or receiving wallet mismatch'; end if;
  if input->>'checkout_request_id' is null then raise exception 'Checkout request ID required'; end if;
  perform pg_advisory_xact_lock(hashtext('crypto-checkout:'||(input->>'checkout_request_id')));
  select * into existing_order from public.ap_payment_orders where checkout_request_id=(input->>'checkout_request_id')::uuid;
  if existing_order.id is not null then
    if existing_order.agency_id is distinct from (input->>'agency_id')::uuid or existing_order.created_by is distinct from (input->>'created_by')::uuid
      or existing_order.plan_code is distinct from input->>'plan_code' or existing_order.billing_cycle is distinct from input->>'billing_cycle'
      or existing_order.crypto_asset is distinct from input->>'crypto_asset' or existing_order.crypto_network is distinct from net
      or existing_order.total_amount is distinct from price or existing_order.wallet_generation is distinct from 'trust_wallet_v1'
      or existing_order.payer_email is distinct from input->>'payer_email' or existing_order.payer_company_name is distinct from input->>'payer_company_name' or existing_order.payer_billing_address is distinct from input->>'payer_billing_address' then raise exception 'Checkout request already used for different details'; end if;
    select id,ap_invoices.invoice_number into invoice_id,invoice_number from public.ap_invoices where order_id=existing_order.id;
    return jsonb_build_object('order_id',existing_order.id,'invoice_id',invoice_id,'invoice_number',invoice_number,'address',existing_order.receiving_address);
  end if;
  if net not in ('BEP20','ERC20','TRC20','ARBITRUM','BASE','BITCOIN') or input->>'crypto_asset' not in ('USDT','USDC','BTC')
    or input->>'billing_cycle' not in ('monthly','annual') or input->>'plan_code' not in ('prive','select','elite')
    or coalesce((input->>'total_amount')::numeric,0)<=0 or coalesce((input->>'expected_crypto_amount')::numeric,0)<=0
    or coalesce(input->>'token_contract','')='' or (input->>'payment_expires_at')::timestamptz<=now() or (input->>'payment_expires_at')::timestamptz>now()+interval '31 minutes'
    or coalesce((input->>'token_decimals')::integer,-1) not between 0 and 18
    or coalesce((input->>'required_confirmations')::integer,0)<1 then raise exception 'Invalid payment invoice'; end if;
  -- Shared wallet addresses support concurrent invoices with distinct exact amounts.
  select case when net in ('BEP20','ERC20','ARBITRUM','BASE') then lower(value) else value end into chosen
    from jsonb_array_elements_text(addresses) with ordinality a(value,position) where value<>'' order by position limit 1;
  if chosen is null then raise exception 'No verified receiving address is configured'; end if;
  perform pg_advisory_xact_lock(hashtextextended('shared-crypto:'||net||':'||chosen||':'||(input->>'token_contract'),0));
  base_amount:=(input->>'expected_crypto_amount')::numeric;
  step:=case when input->>'crypto_asset'='BTC' then 0.00000001 else 0.000001 end;
  if base_amount<=0 or base_amount<>trunc(base_amount*power(10::numeric,(input->>'token_decimals')::int))/power(10::numeric,(input->>'token_decimals')::int) then raise exception 'Invalid quote precision'; end if;
  if input->>'crypto_asset' in ('USDT','USDC') and base_amount<>price then raise exception 'Stablecoin quote mismatch'; end if;
  if input->>'crypto_asset'='BTC' and ((input->>'usd_rate')::numeric<=0 or abs(base_amount*(input->>'usd_rate')::numeric-price)>0.02 or (input->>'quoted_at')::timestamptz<now()-interval '10 minutes' or (input->>'quoted_at')::timestamptz>now()+interval '1 minute') then raise exception 'Invalid Bitcoin price quote'; end if;
  -- Reserve amounts permanently, including expired/paid invoices, to prevent late deposits paying new invoices.
  select base_amount+i*step into allocated from generate_series(0,case when input->>'crypto_asset'='BTC' then 999 else 9999 end) i
    where not exists(select 1 from public.ap_payment_orders q where q.wallet_generation='trust_wallet_v1' and q.crypto_network=net and q.receiving_address=chosen and q.token_contract=input->>'token_contract' and q.expected_crypto_amount=base_amount+i*step)
    order by i limit 1;
  if allocated is null then raise exception 'Exact amount allocation exhausted; receiving address rotation required'; end if;
  adjustment:=allocated-base_amount;
  input:=input||jsonb_build_object('expected_crypto_amount',allocated::text,'plan_name',plan.name);
  insert into public.ap_billing_profiles(agency_id,contact_full_name,legal_name,billing_email,billing_address,tax_id,country_code)
    values((input->>'agency_id')::uuid,input->>'payer_full_name',input->>'payer_company_name',input->>'payer_email',input->>'payer_billing_address',nullif(input->>'tax_id',''),coalesce(input->>'country_code','PH'))
    on conflict(agency_id) do update set contact_full_name=excluded.contact_full_name,legal_name=excluded.legal_name,billing_email=excluded.billing_email,billing_address=excluded.billing_address,tax_id=excluded.tax_id,updated_at=now();
  insert into public.ap_payment_orders(id,wallet_generation,receiving_mode,receiving_provider,checkout_request_id,agency_id,plan_code,billing_cycle,provider,currency,subtotal,total_amount,created_by,payer_full_name,payer_email,payer_company_name,payer_billing_address,crypto_asset,crypto_network,receiving_address,expected_crypto_amount,required_confirmations,payment_expires_at,token_contract,token_decimals,scan_cursor)
    values(payment_id,'trust_wallet_v1','shared',coalesce(input->>'receiving_provider','wallet'),(input->>'checkout_request_id')::uuid,(input->>'agency_id')::uuid,input->>'plan_code',input->>'billing_cycle','crypto','USD',(input->>'total_amount')::numeric,(input->>'total_amount')::numeric,(input->>'created_by')::uuid,input->>'payer_full_name',input->>'payer_email',input->>'payer_company_name',input->>'payer_billing_address',input->>'crypto_asset',net,chosen,(input->>'expected_crypto_amount')::numeric,(input->>'required_confirmations')::integer,(input->>'payment_expires_at')::timestamptz,input->>'token_contract',(input->>'token_decimals')::integer,input->>'scan_cursor');
  insert into public.ap_invoices(order_id,agency_id,currency,subtotal,total_amount,due_at,seller_snapshot,customer_snapshot,line_items,payment_snapshot,notes)
    values(payment_id,(input->>'agency_id')::uuid,'USD',(input->>'total_amount')::numeric,(input->>'total_amount')::numeric,(input->>'payment_expires_at')::timestamptz,seller,
    jsonb_build_object('full_name',input->>'payer_full_name','legal_name',input->>'payer_company_name','billing_email',input->>'payer_email','billing_address',input->>'payer_billing_address','tax_id',input->>'tax_id'),
    jsonb_build_array(jsonb_build_object('description',(input->>'plan_name')||' - '||(input->>'billing_cycle'),'quantity',1,'unit_price',(input->>'total_amount')::numeric,'amount',(input->>'total_amount')::numeric)),
    jsonb_build_object('asset',input->>'crypto_asset','network',net,'receiving_address',chosen,'expected_crypto_amount',input->>'expected_crypto_amount','token_contract',input->>'token_contract','expires_at',input->>'payment_expires_at','required_confirmations',input->>'required_confirmations','quoted_at',input->>'quoted_at','usd_rate',input->>'usd_rate','rate_source',input->>'rate_source','receiving_provider',coalesce(input->>'receiving_provider','wallet'),'receiving_mode','shared','status','awaiting_payment','provider','crypto','wallet_generation','trust_wallet_v1','quote_base_amount',base_amount::text,'matching_adjustment',adjustment::text),
    'One-time purchase, no automatic renewal. Send the exact crypto amount, including the displayed matching adjustment, in one transaction. Sender fees are additional. Stablecoins use a 1 USD reference. Verification and reviews remain independent.') returning id,ap_invoices.invoice_number into invoice_id,invoice_number;
  update public.ap_payment_orders set provider_reference=invoice_number,checkout_url='/agency/dashboard/agencies/'||(input->>'agency_id')||'/billing/payments/'||payment_id::text where id=payment_id;
  return jsonb_build_object('order_id',payment_id,'invoice_id',invoice_id,'invoice_number',invoice_number,'address',chosen);
end; $$;


-- No customer-entered TXID chooses the invoice. Exact reserved amounts select it independently.
create or replace function public.ap_resolve_shared_crypto_payment(target_order uuid,evidence jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.ap_payment_orders%rowtype; chosen uuid; claimed uuid; candidates jsonb; net text:=evidence->>'network'; hash text:=lower(evidence->>'txid'); seen timestamptz:=(evidence->>'transaction_at')::timestamptz; actual numeric:=(evidence->>'amount')::numeric; exception_state text;
begin
 select * into p from public.ap_payment_orders where id=target_order;
 if p.wallet_generation is distinct from 'trust_wallet_v1' then return jsonb_build_object('result','unrelated'); end if;
 if net is distinct from p.crypto_network or evidence->>'destination' is distinct from p.receiving_address then return jsonb_build_object('result','unrelated'); end if;
 perform pg_advisory_xact_lock(hashtextextended('shared-crypto:'||net||':'||p.receiving_address||':'||p.token_contract,0));
 perform pg_advisory_xact_lock(hashtextextended('shared-tx:'||net||':'||hash,0));
 select order_id into claimed from public.ap_crypto_tx_claims where network=net and txid=hash;
 if claimed is not null and claimed<>p.id then
   if hash=lower(p.submitted_txid) then
     insert into public.ap_payment_exceptions(order_id,code,txid,details) values(p.id,'duplicate_txid',hash,evidence) on conflict do nothing;
     insert into public.ap_payment_notifications(order_id,kind,event) values(p.id,'admin','duplicate_txid') on conflict do nothing;
   end if;
   return jsonb_build_object('result','claimed_elsewhere');
 end if;
 select q.id into chosen from public.ap_payment_orders q where q.wallet_generation='trust_wallet_v1' and q.crypto_network=net and q.receiving_address=p.receiving_address and q.token_contract=evidence->>'token' and q.expected_crypto_amount=actual and q.created_at<=seen+interval '2 minutes';
 select coalesce(jsonb_agg(q.id::text),'[]'::jsonb) into candidates from public.ap_payment_orders q where q.wallet_generation='trust_wallet_v1' and q.crypto_network=net and q.receiving_address=p.receiving_address and q.token_contract=p.token_contract and q.created_at<=seen+interval '2 minutes' and q.status='pending';
 insert into public.ap_shared_crypto_deposits(network,txid,token,destination,evidence,candidate_ids,matching_state,matched_order_id)
   values(net,hash,evidence->>'token',p.receiving_address,evidence,case when chosen is not null then jsonb_build_array(chosen::text) else candidates end,case when chosen is not null then 'matched' else 'ambiguous' end,chosen)
   on conflict(network,txid,token,destination) do update set evidence=excluded.evidence,candidate_ids=excluded.candidate_ids,matching_state=excluded.matching_state,matched_order_id=excluded.matched_order_id,updated_at=now();
 if chosen=p.id then return jsonb_build_object('result','matched'); end if;
 if chosen is not null then return jsonb_build_object('result','unrelated'); end if;
 -- Incorrect amount cannot be automatically assigned among simultaneous customers.
 if hash=lower(p.submitted_txid) then
   exception_state:=case when evidence->>'token' is distinct from p.token_contract then 'wrong_token' when seen>p.payment_expires_at then 'late_payment' when actual<p.expected_crypto_amount then 'underpaid' when actual>p.expected_crypto_amount then 'overpaid' else 'matching_review' end;
   insert into public.ap_payment_exceptions(order_id,code,txid,details) values(p.id,exception_state,hash,evidence) on conflict do nothing;
   update public.ap_payment_orders set current_crypto_status=exception_state,updated_at=now() where id=p.id and current_crypto_status in ('awaiting_payment','expired','matching_review');
 end if;
 insert into public.ap_payment_notifications(order_id,kind,event) select q.id,'admin','matching_review' from public.ap_payment_orders q where candidates ? q.id::text on conflict do nothing;
 return jsonb_build_object('result','review','candidate_ids',candidates);
end; $$;
create or replace function public.ap_claim_trust_wallet_monitor(worker uuid,batch_size integer default 4)
returns setof jsonb language plpgsql security definer set search_path='' as $$
begin
 return query with picked as(select id from public.ap_payment_orders where provider='crypto' and wallet_generation='trust_wallet_v1' and receiving_provider='wallet' and status='pending' and monitor_after<=now() and (monitor_lock_until is null or monitor_lock_until<now()) order by monitor_after,created_at for update skip locked limit greatest(1,least(batch_size,4)))
 update public.ap_payment_orders p set monitor_worker=worker,monitor_lock_until=now()+interval '10 minutes' from picked where p.id=picked.id returning to_jsonb(p)||jsonb_build_object('expected_crypto_amount',p.expected_crypto_amount::text);
end; $$;
create or replace function public.ap_record_trust_wallet_evidence(target_order uuid,worker uuid,evidence jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare p public.ap_payment_orders%rowtype; result text;
begin
 select * into p from public.ap_payment_orders where id=target_order for update;
 if worker is null or p.monitor_worker is distinct from worker or p.monitor_lock_until is null or p.monitor_lock_until<now() then raise exception 'Monitor lease lost'; end if;
 if p.wallet_generation is distinct from 'trust_wallet_v1' or p.receiving_provider<>'wallet' then raise exception 'Trust Wallet invoice required'; end if;
 if not exists(select 1 from public.ap_trust_wallet_channels c where c.network=p.crypto_network and c.asset=p.crypto_asset and c.token=p.token_contract and c.address=p.receiving_address and c.decimals=p.token_decimals and c.confirmations=p.required_confirmations) then raise exception 'Immutable receiving configuration mismatch'; end if;
 if coalesce(evidence->>'block_hash','')='' or coalesce(evidence->>'block_number','')='' then raise exception 'Independent block evidence required'; end if;
 result:=public.ap_record_crypto_evidence(target_order,worker,evidence);
 if result='confirmed' then
   update public.ap_subscriptions set cancel_at_period_end=true where agency_id=p.agency_id;
 end if;
 return result;
end; $$;
create or replace function public.ap_submit_trust_wallet_hint(target_order uuid,hash text)
returns void language plpgsql security definer set search_path='' as $$
declare p public.ap_payment_orders%rowtype;
begin
 select * into p from public.ap_payment_orders where id=target_order for update;
 if p.wallet_generation is distinct from 'trust_wallet_v1' or p.status<>'pending' then raise exception 'Pending Trust Wallet invoice required'; end if;
 if not ap_private.has_agency_role(p.agency_id,array['owner','admin','billing']) or ap_private.is_staff(array['super_admin','finance']) then raise exception 'Agency billing access required'; end if;
 if (p.crypto_network in ('TRC20','BITCOIN') and hash !~ '^[0-9a-fA-F]{64}$') or (p.crypto_network not in ('TRC20','BITCOIN') and hash !~ '^0x[0-9a-fA-F]{64}$') then raise exception 'Invalid transaction hash'; end if;
 update public.ap_payment_orders set submitted_txid=lower(hash),monitor_after=now(),updated_at=now() where id=p.id;
end; $$;
revoke all on function public.ap_create_trust_wallet_invoice(jsonb,jsonb,jsonb),public.ap_claim_trust_wallet_monitor(uuid,integer),public.ap_record_trust_wallet_evidence(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ap_create_trust_wallet_invoice(jsonb,jsonb,jsonb),public.ap_claim_trust_wallet_monitor(uuid,integer),public.ap_record_trust_wallet_evidence(uuid,uuid,jsonb) to service_role;
revoke all on function public.ap_submit_trust_wallet_hint(uuid,text) from public,anon;
grant execute on function public.ap_submit_trust_wallet_hint(uuid,text) to authenticated;
commit;
