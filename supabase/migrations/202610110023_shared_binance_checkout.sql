begin;
-- Apply migrations 021 and 022 first. Existing invoices, leases and transaction claims are retained.
alter table public.ap_payment_orders add column if not exists receiving_mode text not null default 'dedicated' check(receiving_mode in ('dedicated','shared'));
-- Existing unfinished invoices also use safe shared matching before addresses can be reused.
update public.ap_payment_orders set receiving_mode='shared' where provider='crypto' and status='pending' and token_contract is not null;
update public.ap_invoices i set payment_snapshot=payment_snapshot||jsonb_build_object('receiving_mode','shared')
  from public.ap_payment_orders p where p.id=i.order_id and p.receiving_mode='shared' and i.status<>'paid';
create index if not exists ap_crypto_shared_candidates on public.ap_payment_orders(crypto_network,receiving_address,token_contract,expected_crypto_amount,created_at) where provider='crypto';
create table if not exists public.ap_shared_crypto_deposits(
  network text not null, txid text not null, token text not null, destination text not null,
  evidence jsonb not null, candidate_ids jsonb not null default '[]',
  matching_state text not null check(matching_state in ('unmatched','ambiguous','matched','claimed')),
  matched_order_id uuid references public.ap_payment_orders(id), first_seen_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  primary key(network,txid,token,destination)
);
create table if not exists public.ap_crypto_deposit_assignments(
  network text not null, txid text not null, order_id uuid not null references public.ap_payment_orders(id),
  token text not null, destination text not null, reviewed_by uuid not null references auth.users(id),
  review_note text not null, reviewed_at timestamptz not null default now(), primary key(network,txid)
);
alter table public.ap_shared_crypto_deposits enable row level security;
alter table public.ap_crypto_deposit_assignments enable row level security;
revoke all on public.ap_shared_crypto_deposits,public.ap_crypto_deposit_assignments from public,anon,authenticated;
grant all on public.ap_shared_crypto_deposits,public.ap_crypto_deposit_assignments to service_role;

-- Called only with independently obtained blockchain evidence, inside the same transaction as the claim.
create or replace function public.ap_resolve_shared_crypto_payment(target_order uuid, evidence jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.ap_payment_orders%rowtype; net text:=evidence->>'network'; hash text:=evidence->>'txid';
  observed_token text:=evidence->>'token'; observed_destination text:=evidence->>'destination'; seen timestamptz:=(evidence->>'transaction_at')::timestamptz;
  actual numeric:=(evidence->>'amount')::numeric; candidate_ids jsonb; possible_ids jsonb; chosen uuid; assigned uuid; claimed uuid; state text;
begin
  select * into p from public.ap_payment_orders where id=target_order;
  if p.id is null then raise exception 'Payment order not found'; end if;
  if net in ('BEP20','ERC20','TRC20') then hash:=lower(hash); end if;
  if coalesce(hash,'')='' or seen is null or actual is null or actual<0 then raise exception 'Independent transaction details required'; end if;
  -- Off-network/off-address hint lookups cannot claim a payment or block the invoice.
  if net is distinct from p.crypto_network or observed_destination is distinct from p.receiving_address then
    return jsonb_build_object('result','unrelated','candidate_ids','[]'::jsonb);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('shared-crypto:'||net||':'||observed_destination||':'||observed_token,0));
  perform pg_advisory_xact_lock(hashtextextended('shared-tx:'||net||':'||hash,0));
  select order_id into claimed from public.ap_crypto_tx_claims where network=net and txid=hash;
  if claimed is not null and claimed<>p.id then
    return jsonb_build_object('result','claimed_elsewhere','candidate_ids','[]'::jsonb);
  end if;
  -- Include paid/expired/cancelled invoices: an old or extra payment must not pay a newer invoice.
  select coalesce(jsonb_agg(q.id::text),'[]'::jsonb) into candidate_ids from public.ap_payment_orders q
    where q.provider='crypto' and q.crypto_network=net and q.receiving_address=observed_destination and q.token_contract=observed_token
      and q.expected_crypto_amount=actual and q.created_at<=seen+interval '2 minutes';
  select coalesce(jsonb_agg(q.id::text),'[]'::jsonb) into possible_ids from public.ap_payment_orders q
    where q.provider='crypto' and q.crypto_network=net and q.receiving_address=observed_destination and q.token_contract=observed_token
      and q.created_at<=seen+interval '2 minutes';
  select order_id into assigned from public.ap_crypto_deposit_assignments a where a.network=net and a.txid=hash and a.token=observed_token and a.destination=observed_destination;
  if assigned is not null then chosen:=assigned;
  elsif jsonb_array_length(candidate_ids)=1 and jsonb_array_length(possible_ids)=1 then chosen:=(candidate_ids->>0)::uuid;
  end if;
  state:=case when claimed is not null then 'claimed' when chosen is not null then 'matched'
    when jsonb_array_length(possible_ids)>1 then 'ambiguous' else 'unmatched' end;
  insert into public.ap_shared_crypto_deposits(network,txid,token,destination,evidence,candidate_ids,matching_state,matched_order_id)
    values(net,hash,observed_token,observed_destination,evidence,possible_ids,state,chosen)
    on conflict(network,txid,token,destination) do update set evidence=excluded.evidence,candidate_ids=excluded.candidate_ids,matching_state=excluded.matching_state,matched_order_id=excluded.matched_order_id,updated_at=now();
  if chosen=p.id then return jsonb_build_object('result','matched','candidate_ids',candidate_ids); end if;
  if chosen is not null then return jsonb_build_object('result','unrelated','candidate_ids',candidate_ids); end if;
  -- A customer-entered TXID never selects the winner. Notify finance without reserving the transaction.
  if not exists(select 1 from public.ap_crypto_tx_claims where network=net and txid=hash) then
    insert into public.ap_payment_notifications(order_id,kind,event)
      select q.id,'admin','matching_review' from public.ap_payment_orders q where q.status='pending'
        and (possible_ids) ? q.id::text
      on conflict do nothing;
  end if;
  return jsonb_build_object('result','review','candidate_ids',possible_ids);
end; $$;

-- Owner/finance associates a deposit after checking payer evidence. This does not approve payment.
create or replace function public.ap_assign_shared_crypto_deposit(net text, hash text, target_order uuid, note text)
returns void language plpgsql security definer set search_path='' as $$
declare p public.ap_payment_orders%rowtype; d public.ap_shared_crypto_deposits%rowtype; existing uuid;
begin
  if auth.uid() is null or not ap_private.is_staff(array['super_admin','finance']) then raise exception 'Finance access required'; end if;
  if length(trim(note))<20 or length(note)>2000 then raise exception 'Record the payer evidence checked (20 to 2000 characters)'; end if;
  if net in ('BEP20','ERC20','TRC20') then hash:=lower(hash); end if;
  select * into p from public.ap_payment_orders where id=target_order for update;
  if p.id is null or p.status<>'pending' or p.receiving_mode<>'shared' then raise exception 'Pending shared invoice required'; end if;
  select * into d from public.ap_shared_crypto_deposits where network=net and txid=hash and token=p.token_contract and destination=p.receiving_address;
  if d.txid is null or not(d.candidate_ids ? p.id::text) then raise exception 'Invoice is not a candidate for this deposit'; end if;
  perform pg_advisory_xact_lock(hashtextextended('shared-crypto:'||net||':'||p.receiving_address||':'||p.token_contract,0));
  perform pg_advisory_xact_lock(hashtextextended('shared-tx:'||net||':'||hash,0));
  select order_id into existing from public.ap_crypto_tx_claims where network=net and txid=hash;
  if existing is not null and existing<>p.id then raise exception 'This transaction is already assigned to another payment'; end if;
  select order_id into existing from public.ap_crypto_deposit_assignments where network=net and txid=hash;
  if existing is not null then raise exception 'This transaction already has a reviewed assignment'; end if;
  insert into public.ap_crypto_deposit_assignments(network,txid,order_id,token,destination,reviewed_by,review_note)
    values(net,hash,p.id,p.token_contract,p.receiving_address,auth.uid(),trim(note));
  update public.ap_shared_crypto_deposits set matching_state='matched',matched_order_id=p.id,updated_at=now() where network=net and txid=hash and token=p.token_contract and destination=p.receiving_address;
  -- Worker must fetch fresh evidence and recheck exact amount, expiry, finality and Binance credit.
  update public.ap_payment_orders set submitted_txid=hash,monitor_after=now(),updated_at=now() where id=p.id;
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
    values(auth.uid(),p.agency_id,'payment.deposit_assignment_reviewed','payment',p.id::text,jsonb_build_object('network',net,'txid',hash,'note',trim(note)));
end; $$;
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
  -- A Binance address may receive any number of invoices, across assets and networks.
  select case when net in ('BEP20','ERC20') then lower(value) else value end into chosen
    from jsonb_array_elements_text(addresses) with ordinality a(value,position) where value<>'' order by position limit 1;
  if chosen is null then raise exception 'No verified receiving address is configured'; end if;
  perform pg_advisory_xact_lock(hashtextextended('shared-crypto:'||net||':'||chosen||':'||(input->>'token_contract'),0));
  insert into public.ap_billing_profiles(agency_id,contact_full_name,legal_name,billing_email,billing_address,tax_id,country_code)
    values((input->>'agency_id')::uuid,input->>'payer_full_name',input->>'payer_company_name',input->>'payer_email',input->>'payer_billing_address',nullif(input->>'tax_id',''),coalesce(input->>'country_code','PH'))
    on conflict(agency_id) do update set contact_full_name=excluded.contact_full_name,legal_name=excluded.legal_name,billing_email=excluded.billing_email,billing_address=excluded.billing_address,tax_id=excluded.tax_id,updated_at=now();
  insert into public.ap_payment_orders(id,receiving_mode,receiving_provider,checkout_request_id,agency_id,plan_code,billing_cycle,provider,currency,subtotal,total_amount,created_by,payer_full_name,payer_email,payer_company_name,payer_billing_address,crypto_asset,crypto_network,receiving_address,expected_crypto_amount,required_confirmations,payment_expires_at,token_contract,token_decimals,scan_cursor)
    values(payment_id,'shared',coalesce(input->>'receiving_provider','wallet'),(input->>'checkout_request_id')::uuid,(input->>'agency_id')::uuid,input->>'plan_code',input->>'billing_cycle','crypto','USD',(input->>'total_amount')::numeric,(input->>'total_amount')::numeric,(input->>'created_by')::uuid,input->>'payer_full_name',input->>'payer_email',input->>'payer_company_name',input->>'payer_billing_address',input->>'crypto_asset',net,chosen,(input->>'expected_crypto_amount')::numeric,(input->>'required_confirmations')::integer,(input->>'payment_expires_at')::timestamptz,input->>'token_contract',(input->>'token_decimals')::integer,input->>'scan_cursor');
  insert into public.ap_invoices(order_id,agency_id,currency,subtotal,total_amount,due_at,seller_snapshot,customer_snapshot,line_items,payment_snapshot,notes)
    values(payment_id,(input->>'agency_id')::uuid,'USD',(input->>'total_amount')::numeric,(input->>'total_amount')::numeric,(input->>'payment_expires_at')::timestamptz,seller,
    jsonb_build_object('full_name',input->>'payer_full_name','legal_name',input->>'payer_company_name','billing_email',input->>'payer_email','billing_address',input->>'payer_billing_address','tax_id',input->>'tax_id'),
    jsonb_build_array(jsonb_build_object('description',(input->>'plan_name')||' - '||(input->>'billing_cycle'),'quantity',1,'unit_price',(input->>'total_amount')::numeric,'amount',(input->>'total_amount')::numeric)),
    jsonb_build_object('asset',input->>'crypto_asset','network',net,'receiving_address',chosen,'expected_crypto_amount',input->>'expected_crypto_amount','token_contract',input->>'token_contract','expires_at',input->>'payment_expires_at','required_confirmations',input->>'required_confirmations','quoted_at',input->>'quoted_at','usd_rate',input->>'usd_rate','rate_source',input->>'rate_source','receiving_provider',coalesce(input->>'receiving_provider','wallet'),'receiving_mode','shared','status','awaiting_payment'),
    'Payment purchases subscription tools only. Verification and reviews remain independent.') returning id,ap_invoices.invoice_number into invoice_id,invoice_number;
  update public.ap_payment_orders set provider_reference=invoice_number,checkout_url='/agency/dashboard/agencies/'||(input->>'agency_id')||'/billing/payments/'||payment_id::text where id=payment_id;
  return jsonb_build_object('order_id',payment_id,'invoice_id',invoice_id,'invoice_number',invoice_number,'address',chosen);
end; $$;

create or replace function public.ap_record_crypto_evidence(target_order uuid, worker uuid, evidence jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare p public.ap_payment_orders%rowtype; state text; hash text; net text; actual numeric; seen timestamptz; claimed uuid; old_state text; resolution jsonb; hint boolean := coalesce((evidence->>'hint_only')::boolean,false);
begin
  select * into p from public.ap_payment_orders where id=target_order for update;
  if p.id is null or p.monitor_worker is distinct from worker or p.monitor_lock_until<now() then raise exception 'Monitor lease lost'; end if;
  if p.status<>'pending' then return p.current_crypto_status; end if;
  net:=evidence->>'network'; hash:=evidence->>'txid';
  if net in ('BEP20','ERC20','TRC20') then hash:=lower(hash); end if;
  if coalesce(hash,'')='' then raise exception 'Verified blockchain TXID required'; end if;
  actual:=(evidence->>'amount')::numeric; seen:=(evidence->>'transaction_at')::timestamptz;
  if actual<0 or actual is null or seen is null then raise exception 'Incomplete blockchain evidence'; end if;
  if p.receiving_mode='shared' then
    resolution:=public.ap_resolve_shared_crypto_payment(p.id,evidence);
    if resolution->>'result'<>'matched' then
      if resolution->>'result'='review' then
        -- Keep unpaid customers awaiting payment. Show review only for their lookup hint or previously detected transaction.
        if (resolution->'candidate_ids') ? p.id::text and (hash=p.submitted_txid or hash=p.verified_transaction_hash) and p.current_crypto_status in ('awaiting_payment','detected','confirming','matching_review') then
          update public.ap_payment_orders set current_crypto_status='matching_review',updated_at=now() where id=p.id;
          return 'matching_review';
        end if;
      end if;
      if resolution->>'result'='unrelated' and hash=(case when net in ('BEP20','ERC20','TRC20') then lower(p.submitted_txid) else p.submitted_txid end) then
        -- A wrong-network/address customer hint is support evidence, never an invoice assignment.
        state:=case when net is distinct from p.crypto_network then 'wrong_network' else 'wrong_destination' end;
        insert into public.ap_crypto_observations(order_id,evidence,state) values(p.id,evidence,state);
        insert into public.ap_payment_exceptions(order_id,code,txid,details) values(p.id,state,hash,evidence) on conflict do nothing;
        insert into public.ap_payment_notifications(order_id,kind,event) values(p.id,'admin',state) on conflict do nothing;
      end if;
      return p.current_crypto_status;
    end if;
  end if;
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
    when coalesce((evidence->>'confirmations')::integer,0)<p.required_confirmations or coalesce((evidence->>'finalized')::boolean,false)=false or (p.receiving_provider='binance' and not coalesce((evidence->>'custodian_credit')::boolean,false)) then 'confirming'
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

create or replace function public.ap_activate_crypto_payment(target_order uuid, verified_txid text, confirmations integer)
returns void language plpgsql security definer set search_path='' as $$
declare p public.ap_payment_orders%rowtype; proof jsonb; invoice_id uuid; existing public.ap_subscriptions%rowtype; started timestamptz; resolution jsonb;
begin
  select * into p from public.ap_payment_orders where id=target_order for update;
  if p.id is null then raise exception 'Payment order not found'; end if;
  if p.status='paid' then return; end if;
  if p.status<>'pending' or p.provider<>'crypto' then raise exception 'Payment cannot be activated'; end if;
  select evidence into proof from public.ap_crypto_observations where order_id=p.id and state='confirmed' and evidence->>'txid'=verified_txid order by created_at desc limit 1;
  if p.current_crypto_status<>'confirming' or p.verified_transaction_hash is distinct from verified_txid or proof is null or not coalesce((proof->>'successful')::boolean,false) or not coalesce((proof->>'finalized')::boolean,false)
    or coalesce((proof->>'confirmations')::integer,0)<p.required_confirmations or (p.receiving_provider='binance' and (not coalesce((proof->>'custodian_credit')::boolean,false) or nullif(proof->>'custodian_deposit_id','') is null))
    or confirmations<p.required_confirmations or confirmations is distinct from (proof->>'confirmations')::integer
    or proof->>'token' is distinct from p.token_contract or proof->>'network' is distinct from p.crypto_network
    or proof->>'destination' is distinct from p.receiving_address or (proof->>'amount')::numeric<>p.expected_crypto_amount
    or (proof->>'transaction_at')::timestamptz>p.payment_expires_at or (proof->>'transaction_at')::timestamptz<p.created_at-interval '2 minutes'
    or not exists(select 1 from public.ap_crypto_tx_claims where network=p.crypto_network and txid=verified_txid and order_id=p.id)
    then raise exception 'Independent finalized blockchain evidence required'; end if;
  if p.receiving_mode='shared' then
    resolution:=public.ap_resolve_shared_crypto_payment(p.id,proof);
    if resolution->>'result'<>'matched' then raise exception 'Unambiguous or owner-reviewed invoice assignment required'; end if;
  end if;
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


revoke all on function public.ap_resolve_shared_crypto_payment(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ap_resolve_shared_crypto_payment(uuid,jsonb) to service_role;
revoke all on function public.ap_assign_shared_crypto_deposit(text,text,uuid,text) from public,anon;
grant execute on function public.ap_assign_shared_crypto_deposit(text,text,uuid,text) to authenticated;
revoke all on function public.ap_create_reliable_crypto_invoice(jsonb,jsonb,jsonb),public.ap_record_crypto_evidence(uuid,uuid,jsonb),public.ap_activate_crypto_payment(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.ap_create_reliable_crypto_invoice(jsonb,jsonb,jsonb),public.ap_record_crypto_evidence(uuid,uuid,jsonb),public.ap_activate_crypto_payment(uuid,text,integer) to service_role;
commit;
