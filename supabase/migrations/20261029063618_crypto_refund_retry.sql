begin;
-- Refund-and-retry bookkeeping only. This file never sends funds or grants access.
create table if not exists public.ap_crypto_refund_cases (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.ap_payment_orders(id),
 exception_id uuid not null references public.ap_payment_exceptions(id),
 network text not null, deposit_txid text not null,
 asset text not null, deposit_amount numeric not null check(deposit_amount>0),
 evidence jsonb not null, ownership_note text not null check(length(trim(ownership_note)) between 20 and 2000),
 state text not null default 'refund_required' check(state in ('refund_required','refund_recorded')),
 opened_by uuid not null references auth.users(id), opened_at timestamptz not null default now(),
 refund_txid text, refund_amount numeric, refund_destination text, refund_note text,
 recorded_by uuid references auth.users(id), recorded_at timestamptz,
 unique(network,deposit_txid), unique(network,refund_txid),
 check ((state='refund_required' and refund_txid is null and recorded_at is null)
   or (state='refund_recorded' and refund_txid is not null and refund_amount>0 and refund_destination is not null and recorded_by is not null and recorded_at is not null))
);
alter table public.ap_crypto_refund_cases enable row level security;
revoke all on public.ap_crypto_refund_cases from public,anon,authenticated;
grant select on public.ap_crypto_refund_cases to service_role;

create or replace function ap_private.open_crypto_refund(target_exception uuid, owner_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.ap_payment_exceptions%rowtype; p public.ap_payment_orders%rowtype;
 d public.ap_shared_crypto_deposits%rowtype; existing public.ap_crypto_refund_cases%rowtype;
 proof jsonb; result_id uuid; claimed uuid;
begin
 if auth.uid() is null or not coalesce(ap_private.is_staff(array['super_admin']),false) then raise exception 'Owner access required'; end if;
 if coalesce(length(trim(owner_note)),0) not between 20 and 2000 then raise exception 'Record payer ownership evidence in 20 to 2000 characters'; end if;
 select * into e from public.ap_payment_exceptions where id=target_exception;
 if e.id is null or e.code not in ('underpaid','overpaid','late_payment') then raise exception 'Underpayment, overpayment or late-payment exception required'; end if;
 select * into p from public.ap_payment_orders where id=e.order_id for update;
 if p.wallet_generation is distinct from 'trust_wallet_v1' or p.receiving_provider is distinct from 'wallet' or p.provider<>'crypto' then raise exception 'Current wallet invoice required'; end if;
 select * into existing from public.ap_crypto_refund_cases where order_id=p.id;
 if existing.id is not null then
   if existing.exception_id<>e.id then raise exception 'Invoice already has a refund case'; end if;
   return existing.id;
 end if;
 if p.status<>'pending' then raise exception 'Only unpaid pending invoices can enter refund review'; end if;
 perform 1 from public.ap_invoices where order_id=p.id and status in ('open','overdue') for update;
 if not found then raise exception 'An unpaid open or overdue invoice is required'; end if;
 -- Same locks used by the wallet matcher; never assign another invoice's deposit.
 perform pg_advisory_xact_lock(hashtextextended('shared-crypto:'||p.crypto_network||':'||p.receiving_address||':'||p.token_contract,0));
 perform pg_advisory_xact_lock(hashtextextended('shared-tx:'||p.crypto_network||':'||lower(e.txid),0));
 select * into d from public.ap_shared_crypto_deposits where network=p.crypto_network and txid=lower(e.txid) and token=p.token_contract and destination=p.receiving_address for update;
 proof:=d.evidence;
 if d.txid is null or (d.matched_order_id is not null and d.matched_order_id<>p.id)
   or proof->>'network' is distinct from p.crypto_network or lower(proof->>'txid') is distinct from lower(e.txid)
   or proof->>'token' is distinct from p.token_contract or proof->>'destination' is distinct from p.receiving_address
   or coalesce((proof->>'successful')::boolean,false)=false or coalesce((proof->>'finalized')::boolean,false)=false
   or coalesce((proof->>'confirmations')::int,0)<p.required_confirmations
   or coalesce(proof->>'block_hash','')='' or coalesce(proof->>'block_number','')=''
   or coalesce((proof->>'amount')::numeric,0)<=0 or proof->>'transaction_at' is null
   or (proof->>'transaction_at')::timestamptz<p.created_at-interval '2 minutes'
 then raise exception 'Finalized independent deposit evidence required'; end if;
 if not ((proof->>'amount')::numeric<>p.expected_crypto_amount or (proof->>'transaction_at')::timestamptz>p.payment_expires_at) then raise exception 'Exact on-time payments must use automatic verification'; end if;
 if exists(select 1 from public.ap_payment_orders q where q.id<>p.id and q.wallet_generation='trust_wallet_v1' and q.crypto_network=p.crypto_network and q.receiving_address=p.receiving_address and q.token_contract=p.token_contract and q.expected_crypto_amount=(proof->>'amount')::numeric and q.created_at<=(proof->>'transaction_at')::timestamptz+interval '2 minutes') then raise exception 'Deposit matches another invoice'; end if;
 insert into public.ap_crypto_tx_claims(network,txid,order_id) values(p.crypto_network,lower(e.txid),p.id) on conflict do nothing;
 select order_id into claimed from public.ap_crypto_tx_claims where network=p.crypto_network and txid=lower(e.txid);
 if claimed is distinct from p.id then raise exception 'Deposit already claimed by another invoice'; end if;
 insert into public.ap_crypto_refund_cases(order_id,exception_id,network,deposit_txid,asset,deposit_amount,evidence,ownership_note,opened_by)
 values(p.id,e.id,p.crypto_network,lower(e.txid),p.crypto_asset,(proof->>'amount')::numeric,proof,trim(owner_note),auth.uid()) returning id into result_id;
 -- Prevent a later monitor pass from activating the old invoice. Preserve exact amount reservation.
 update public.ap_payment_orders set status='cancelled',monitor_worker=null,monitor_lock_until=null,updated_at=now() where id=p.id;
 update public.ap_invoices set status='void',payment_snapshot=payment_snapshot||jsonb_build_object('refund_case_id',result_id,'refund_status','refund_required'),updated_at=now() where order_id=p.id and status in ('open','overdue');
 update public.ap_payment_exceptions set reviewed_by=auth.uid(),review_note=trim(owner_note),reviewed_at=now() where id=e.id;
 insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata) values(auth.uid(),p.agency_id,'payment.refund_opened','crypto_refund_case',result_id::text,jsonb_build_object('order_id',p.id,'deposit_txid',lower(e.txid),'note',trim(owner_note)));
 return result_id;
end; $$;

create or replace function ap_private.record_crypto_refund(target_case uuid, transaction_hash text, amount text, destination text, owner_note text)
returns void language plpgsql security definer set search_path='' as $$
declare c public.ap_crypto_refund_cases%rowtype; value numeric; hash text:=lower(trim(transaction_hash));
begin
 if auth.uid() is null or not coalesce(ap_private.is_staff(array['super_admin']),false) then raise exception 'Owner access required'; end if;
 select * into c from public.ap_crypto_refund_cases where id=target_case for update;
 if c.id is null then raise exception 'Refund case not found'; end if;
 if coalesce(length(trim(owner_note)),0) not between 20 and 2000 or coalesce(length(trim(destination)),0) not between 10 and 200 then raise exception 'Refund destination and 20 to 2000 character note required'; end if;
 if coalesce(amount,'') !~ '^[0-9]+([.][0-9]+)?$' then raise exception 'Positive refund amount required'; end if;
 value:=amount::numeric;
 -- Full deposit refund; any network fees are paid separately by the operator.
 if value<>c.deposit_amount then raise exception 'Record the full deposit amount; partial refunds require separate support handling'; end if;
 if (c.network in ('BITCOIN','TRC20') and coalesce(hash,'') !~ '^[0-9a-f]{64}$') or (c.network not in ('BITCOIN','TRC20') and coalesce(hash,'') !~ '^0x[0-9a-f]{64}$') or hash=c.deposit_txid then raise exception 'Valid outgoing refund transaction required'; end if;
 if c.state='refund_recorded' then
   if c.refund_txid=hash and c.refund_amount=value and c.refund_destination=trim(destination) and c.refund_note=trim(owner_note) then return; end if;
   raise exception 'Refund already recorded; audit history cannot be overwritten';
 end if;
 update public.ap_crypto_refund_cases set state='refund_recorded',refund_txid=hash,refund_amount=value,refund_destination=trim(destination),refund_note=trim(owner_note),recorded_by=auth.uid(),recorded_at=now() where id=c.id;
 update public.ap_invoices set payment_snapshot=payment_snapshot||jsonb_build_object('refund_status','refund_recorded','refund_txid',hash,'refund_amount',value::text,'refund_recorded_at',now()),updated_at=now() where order_id=c.order_id;
 insert into public.ap_security_audit(actor_user_id,action,target_type,target_id,metadata) values(auth.uid(),'payment.refund_recorded','crypto_refund_case',c.id::text,jsonb_build_object('refund_txid',hash,'amount',value::text,'destination',trim(destination),'note',trim(owner_note)));
end; $$;
revoke all on function ap_private.open_crypto_refund(uuid,text),ap_private.record_crypto_refund(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function ap_private.open_crypto_refund(uuid,text),ap_private.record_crypto_refund(uuid,text,text,text,text) to authenticated;
create or replace function public.ap_open_crypto_refund(target_exception uuid,owner_note text)
returns uuid language sql security invoker set search_path='' as $$ select ap_private.open_crypto_refund(target_exception,owner_note); $$;
create or replace function public.ap_record_crypto_refund(target_case uuid,transaction_hash text,amount text,destination text,owner_note text)
returns void language sql security invoker set search_path='' as $$ select ap_private.record_crypto_refund(target_case,transaction_hash,amount,destination,owner_note); $$;
revoke all on function public.ap_open_crypto_refund(uuid,text),public.ap_record_crypto_refund(uuid,text,text,text,text) from public,anon;
grant execute on function public.ap_open_crypto_refund(uuid,text),public.ap_record_crypto_refund(uuid,text,text,text,text) to authenticated;
commit;
