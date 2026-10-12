import {randomUUID} from "node:crypto";
import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import {decimalUnits,evaluate,type PaymentOrder,type Observation} from "../lib/billing/reliable/domain";
let db:PGlite;
const agency="10000000-0000-4000-8000-000000000001",user="20000000-0000-4000-8000-000000000001",worker="30000000-0000-4000-8000-000000000001";
let serial=0;
const token="0x"+"a".repeat(40);
async function invoice(cycle="monthly",provider="wallet",shared=false,reuseAddress?:string,targetAgency=agency) {
  const address=reuseAddress||"0x"+(++serial).toString(16).padStart(40,"0");
  const input={receiving_provider:provider,checkout_request_id:randomUUID(),agency_id:targetAgency,created_by:user,plan_code:"prive",plan_name:"Prive",billing_cycle:cycle,total_amount:49,payer_full_name:"Test owner",payer_company_name:"Test agency",payer_email:"billing@example.com",payer_billing_address:"Test billing address",crypto_asset:"USDT",crypto_network:"BEP20",token_contract:token,token_decimals:6,required_confirmations:12,expected_crypto_amount:"49.00",payment_expires_at:new Date(Date.now()+1800000).toISOString(),scan_cursor:"123"};
  const result=await db.query<{result:{order_id:string;address:string}}>("select public.ap_create_reliable_crypto_invoice($1::jsonb,$2::jsonb,'{}'::jsonb) result",[JSON.stringify(input),JSON.stringify([address])]);
  const id=result.rows[0].result.order_id;
  if(!shared) await db.query("update ap_payment_orders set receiving_mode='dedicated' where id=$1",[id]);
  await db.query("update ap_payment_orders set monitor_worker=$1,monitor_lock_until=now()+interval '10 minutes' where id=$2",[worker,id]);
  return {id,address,input};
}
async function state(id:string) {return (await db.query<{status:string;current_crypto_status:string}>("select status,current_crypto_status from ap_payment_orders where id=$1",[id])).rows[0];}
function evidence(address:string,overrides:Record<string,unknown>={}) {return {txid:"0x"+(++serial).toString(16).padStart(64,"0"),network:"BEP20",token,destination:address,amount:"49.00",confirmations:12,finalized:true,successful:true,block_hash:"0xblock",block_number:"124",transaction_at:new Date().toISOString(),transfer_index:0,...overrides};}
async function record(id:string,proof:Record<string,unknown>) {return (await db.query<{state:string}>("select public.ap_record_crypto_evidence($1,$2,$3::jsonb) state",[id,worker,JSON.stringify(proof)])).rows[0].state;}
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema ap_private;
  create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
  create function ap_private.has_agency_role(uuid,text[]) returns boolean language sql as $$select false$$;
  create function ap_private.is_staff(text[]) returns boolean language sql as $$select coalesce(current_setting('test.staff',true),'false')='true'$$;
  create table ap_agencies(id uuid primary key);create table ap_plans(code text primary key);
  create table ap_subscriptions(id uuid primary key default gen_random_uuid(),agency_id uuid unique,plan_code text,status text,current_period_started_at timestamptz,current_period_ends_at timestamptz,commercial_reference text,cancel_at_period_end boolean,updated_at timestamptz);
  create table ap_security_audit(actor_user_id uuid,agency_id uuid,action text,target_type text,target_id text,metadata jsonb);
  insert into auth.users values('${user}');insert into ap_agencies values('${agency}');insert into ap_plans values('prive'),('select'),('elite');`);
  await db.exec(readFileSync("supabase/migrations/202610080017_crypto_billing.sql","utf8"));
  await db.exec(readFileSync("supabase/migrations/202610110021_reliable_crypto_payments.sql","utf8"));
  await db.exec(readFileSync("supabase/migrations/202610110022_binance_credit_verification.sql","utf8"));
  await db.exec(readFileSync("supabase/migrations/202610110023_shared_binance_checkout.sql","utf8"));
},30000);
afterAll(async()=>{await db?.close();});
describe("independent payment activation",()=>{
  it("requires independent chain finality and Binance credit before activation",async()=>{
    const p=await invoice("monthly","binance"),proof=evidence(p.address);
    expect(await record(p.id,proof)).toBe("confirming");expect((await state(p.id)).status).toBe("pending");
    expect(await record(p.id,{...proof,custodian_credit:true,custodian_deposit_id:"binance-deposit-123"})).toBe("confirmed");expect((await state(p.id)).status).toBe("paid");
  });
  it("retries checkout without generating another invoice or consuming an address",async()=>{
    const p=await invoice();const result=await db.query<{result:{order_id:string}}>("select ap_create_reliable_crypto_invoice($1::jsonb,$2::jsonb,'{}'::jsonb) result",[JSON.stringify(p.input),JSON.stringify([p.address])]);expect(result.rows[0].result.order_id).toBe(p.id);
    const count=await db.query<{n:number}>("select count(*) n from ap_invoices where order_id=$1",[p.id]);expect(Number(count.rows[0].n)).toBe(1);
  });
  it("rejects direct activation and customer TXID as proof",async()=>{
    const p=await invoice();await db.query("update ap_payment_orders set submitted_txid='hint' where id=$1",[p.id]);
    await expect(db.query("select ap_activate_crypto_payment($1,'hint',999)",[p.id])).rejects.toThrow("Independent finalized");
    expect((await state(p.id)).status).toBe("pending");
  });
  it("records zero-confirmation detection separately",async()=>{
    const p=await invoice();expect(await record(p.id,evidence(p.address,{confirmations:0,finalized:false}))).toBe("detected");expect((await state(p.id)).status).toBe("pending");
  });
  it("does not allow an inflated confirmation count through the activation RPC",async()=>{
    const p=await invoice(),proof=evidence(p.address);
    await db.query("insert into ap_crypto_observations(order_id,evidence,state) values($1,$2::jsonb,'confirmed')",[p.id,JSON.stringify(proof)]);
    await db.query("insert into ap_crypto_tx_claims(network,txid,order_id) values('BEP20',$1,$2)",[proof.txid,p.id]);
    await db.query("update ap_payment_orders set current_crypto_status='confirming',verified_transaction_hash=$1 where id=$2",[proof.txid,p.id]);
    await expect(db.query("select ap_activate_crypto_payment($1,$2,999)",[p.id,proof.txid])).rejects.toThrow("Independent finalized");expect((await state(p.id)).status).toBe("pending");
  });
  it("waits for confirmations AND finality",async()=>{
    const p=await invoice(),proof=evidence(p.address,{confirmations:1,finalized:false});
    expect(await record(p.id,proof)).toBe("confirming");expect((await state(p.id)).status).toBe("pending");
    expect(await record(p.id,{...proof,confirmations:12,finalized:false})).toBe("confirming");
    expect(await record(p.id,{...proof,confirmations:12,finalized:true})).toBe("confirmed");expect((await state(p.id)).status).toBe("paid");
    const notifications=await db.query("select * from ap_payment_notifications where order_id=$1 and event='confirmed'",[p.id]);expect(notifications.rows).toHaveLength(2);
    const before=await db.query("select current_period_ends_at::text ending from ap_subscriptions where agency_id=$1",[agency]);
    await db.query("select ap_activate_crypto_payment($1,$2,12)",[p.id,proof.txid]);
    const after=await db.query("select current_period_ends_at::text ending from ap_subscriptions where agency_id=$1",[agency]);expect(after.rows).toEqual(before.rows);
  });
  it.each([["underpaid",{amount:"48.99"}],["overpaid",{amount:"49.01"}],["wrong_token",{token:"0x"+"b".repeat(40)}],["wrong_network",{network:"ERC20"}],["wrong_destination",{destination:"0x"+"c".repeat(40)}],["late_payment",{transaction_at:new Date(Date.now()+3600000).toISOString()}],["failed_on_chain",{successful:false}]])("keeps %s unpaid",async(expected,override)=>{
    const p=await invoice();expect(await record(p.id,evidence(p.address,override as Record<string,unknown>))).toBe(expected);expect((await state(p.id)).status).toBe("pending");
  });
  it("does not allow a second transfer to silently resolve underpayment",async()=>{
    const p=await invoice();await record(p.id,evidence(p.address,{amount:"40"}));expect(await record(p.id,evidence(p.address))).toBe("underpaid");expect((await state(p.id)).status).toBe("pending");
  });
  it("allows a new invoice to reuse an expired invoice address without deleting its records",async()=>{
    const p=await invoice();await db.query("update ap_payment_orders set payment_expires_at=now()-interval '1 minute' where id=$1",[p.id]);
    await db.query("select ap_finish_crypto_monitor($1,$2,'123',null)",[p.id,worker]);expect((await state(p.id)).current_crypto_status).toBe("expired");
    const next=await invoice("monthly","wallet",true,p.address);expect(next.id).not.toBe(p.id);expect(next.address).toBe(p.address);expect((await state(p.id)).current_crypto_status).toBe("expired");
  });
  it("prevents duplicate TXID from crediting two invoices",async()=>{
    const a=await invoice(),b=await invoice(),proof=evidence(a.address);
    await record(a.id,proof);expect(await record(b.id,{...proof,destination:b.address})).toBe("duplicate_txid");expect((await state(b.id)).status).toBe("pending");
  });
  it("does not let an unrelated customer hint block real payment",async()=>{
    const p=await invoice();await record(p.id,evidence("0x"+"e".repeat(40),{hint_only:true}));expect((await state(p.id)).current_crypto_status).toBe("awaiting_payment");expect(await record(p.id,evidence(p.address))).toBe("confirmed");
  });
  it("extends annual billing by one year and keeps exact quote as a string",async()=>{
    const p=await invoice("annual");await record(p.id,evidence(p.address));
    const period=await db.query<{days:number}>("select extract(epoch from(current_period_ends_at-now()))/86400 days from ap_subscriptions where agency_id=$1",[agency]);expect(Number(period.rows[0].days)).toBeGreaterThan(364);
    await db.query("update ap_payment_orders set monitor_after=now()-interval '1 minute',monitor_lock_until=null where status='pending'");
    const claims=await db.query<{item:{expected_crypto_amount:unknown}}>("select ap_claim_crypto_monitor($1,20) item",[worker]);expect(typeof claims.rows[0].item.expected_crypto_amount).toBe("string");
  });
  it("denies authenticated users activation and evidence-writing privileges",async()=>{
    const result=await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','public.ap_activate_crypto_payment(uuid,text,integer)','EXECUTE') allowed");expect(result.rows[0].allowed).toBe(false);
    const second=await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','public.ap_record_crypto_evidence(uuid,uuid,jsonb)','EXECUTE') allowed");expect(second.rows[0].allowed).toBe(false);
  });
});
describe("exact decimal arithmetic",()=>{
  it("does not use floating point token comparisons",()=>{expect(decimalUnits("123456789012.123456",6).toString()).toBe("123456789012123456");expect(()=>decimalUnits("1.0000001",6)).toThrow();});
  it("does not accept finality without required confirmations",()=>{
    const order={crypto_network:"BEP20",receiving_address:"wallet",token_contract:"token",token_decimals:6,expected_crypto_amount:"49",required_confirmations:12,created_at:new Date(Date.now()-10000).toISOString(),payment_expires_at:new Date(Date.now()+60000).toISOString()} as PaymentOrder;
    const proof={network:"BEP20",destination:"wallet",token:"token",amount:"49",successful:true,finalized:true,confirmations:0,transaction_at:new Date().toISOString()} as Observation;
    expect(evaluate(order,proof)).toBe("detected");
  });
});

describe("shared Binance invoice matching",()=>{
  const sharedInvoice=(address?:string)=>invoice("monthly","binance",true,address);
  async function assign(id:string,proof:Record<string,unknown>){
    await db.query("select set_config('test.actor',$1,false),set_config('test.staff','true',false)",[user]);
    try {await db.query("select ap_assign_shared_crypto_deposit('BEP20',$1,$2,$3)",[proof.txid,id,"Verified agency identity and independent payer withdrawal records."]);}
    finally {await db.query("select set_config('test.actor','',false),set_config('test.staff','false',false)");}
  }
  it("keeps subscriptions for two different agencies separate during shared checkout",async()=>{
    const otherAgency=randomUUID();await db.query("insert into ap_agencies values($1)",[otherAgency]);
    const a=await sharedInvoice(),b=await invoice("monthly","binance",true,a.address,otherAgency);
    const proof=evidence(a.address,{custodian_credit:true,custodian_deposit_id:"other-agency-credit"});
    await record(a.id,proof);await assign(b.id,proof);expect(await record(b.id,proof)).toBe("confirmed");
    expect((await state(a.id)).status).toBe("pending");const sub=await db.query<{commercial_reference:string}>("select commercial_reference from ap_subscriptions where agency_id=$1",[otherAgency]);expect(sub.rows).toHaveLength(1);
  });
  it("creates many separate invoices on one address with no address reservation",async()=>{
    const first=await sharedInvoice();const results=await Promise.all(Array.from({length:25},()=>sharedInvoice(first.address)));
    expect(new Set([first.id,...results.map(p=>p.id)]).size).toBe(26);expect(results.every(p=>p.address===first.address)).toBe(true);
    const leases=await db.query("select * from ap_crypto_address_leases where address=$1",[first.address]);expect(leases.rows).toHaveLength(0);
  });
  it("does not assign equal simultaneous payments using a customer hash or processing order",async()=>{
    const a=await sharedInvoice(),b=await sharedInvoice(a.address),proof=evidence(a.address,{custodian_credit:true,custodian_deposit_id:"same-amount-deposit"});
    await db.query("update ap_payment_orders set submitted_txid=$1 where id=$2",[proof.txid,a.id]);
    expect(await record(a.id,proof)).toBe("matching_review");expect(await record(b.id,proof)).toBe("awaiting_payment");
    expect((await state(a.id)).status).toBe("pending");expect((await state(b.id)).status).toBe("pending");
    const claims=await db.query("select * from ap_crypto_tx_claims where txid=$1",[proof.txid]);expect(claims.rows).toHaveLength(0);
    const deposits=await db.query<{candidate_ids:string[];matching_state:string}>("select candidate_ids,matching_state from ap_shared_crypto_deposits where txid=$1",[proof.txid]);expect(deposits.rows[0].matching_state).toBe("ambiguous");expect(deposits.rows[0].candidate_ids).toEqual(expect.arrayContaining([a.id,b.id]));
  });
  it("allows audited matching of both customer payments without allowing duplicate activation",async()=>{
    const a=await sharedInvoice(),b=await sharedInvoice(a.address),pa=evidence(a.address,{custodian_credit:true,custodian_deposit_id:"credit-a"}),pb=evidence(a.address,{custodian_credit:true,custodian_deposit_id:"credit-b"});
    await record(a.id,pa);await record(b.id,pb);await assign(a.id,pa);
    expect((await state(a.id)).status).toBe("pending");expect(await record(a.id,pa)).toBe("confirmed");
    await record(b.id,pa);expect((await state(b.id)).status).toBe("pending");
    await expect(assign(b.id,pa)).rejects.toThrow("already assigned");await assign(b.id,pb);expect(await record(b.id,pb)).toBe("confirmed");
    const claims=await db.query("select * from ap_crypto_tx_claims where txid in ($1,$2)",[pa.txid,pb.txid]);expect(claims.rows).toHaveLength(2);
  });
  it("automatically verifies an unambiguous invoice but still waits for Binance credit",async()=>{
    const p=await sharedInvoice(),proof=evidence(p.address);
    expect(await record(p.id,proof)).toBe("confirming");expect((await state(p.id)).status).toBe("pending");
    expect(await record(p.id,{...proof,custodian_credit:true,custodian_deposit_id:"single-credit"})).toBe("confirmed");
  });
  it("does not poison one invoice with a different customer's exact payment",async()=>{
    const a=await sharedInvoice(),b=await sharedInvoice(a.address);
    await db.query("update ap_payment_orders set expected_crypto_amount=99 where id=$1",[b.id]);
    const proof=evidence(a.address,{amount:"99",custodian_credit:true,custodian_deposit_id:"other-customer"});
    expect(await record(a.id,proof)).toBe("awaiting_payment");expect(await record(b.id,proof)).toBe("awaiting_payment");expect((await state(a.id)).status).toBe("pending");await assign(b.id,proof);expect(await record(b.id,proof)).toBe("confirmed");
  });
  it("does not recycle an old amount when an invoice has expired or been paid",async()=>{
    const a=await sharedInvoice();await db.query("update ap_payment_orders set payment_expires_at=now()-interval '1 minute',current_crypto_status='expired' where id=$1",[a.id]);
    const b=await sharedInvoice(a.address),proof=evidence(a.address,{custodian_credit:true,custodian_deposit_id:"late-deposit"});
    expect(await record(b.id,proof)).toBe("awaiting_payment");expect((await state(b.id)).status).toBe("pending");
  });
  it("keeps unmatched underpayments in the shared review queue without guessing the payer",async()=>{
    const a=await sharedInvoice(),b=await sharedInvoice(a.address),proof=evidence(a.address,{amount:"48"});
    await record(a.id,proof);await record(b.id,proof);const deposits=await db.query("select * from ap_shared_crypto_deposits where txid=$1",[proof.txid]);expect(deposits.rows).toHaveLength(1);
    const claims=await db.query("select * from ap_crypto_tx_claims where txid=$1",[proof.txid]);expect(claims.rows).toHaveLength(0);
    await assign(a.id,proof);expect(await record(a.id,proof)).toBe("underpaid");expect((await state(b.id)).status).toBe("pending");
  });
  it("logs wrong-network customer hints without changing invoice matching or claiming the TXID",async()=>{
    const p=await sharedInvoice(),proof=evidence(p.address,{network:"ERC20"});
    await db.query("update ap_payment_orders set submitted_txid=$1 where id=$2",[proof.txid,p.id]);
    expect(await record(p.id,proof)).toBe("awaiting_payment");
    const exceptions=await db.query("select * from ap_payment_exceptions where order_id=$1 and code='wrong_network'",[p.id]);expect(exceptions.rows).toHaveLength(1);
    const claims=await db.query("select * from ap_crypto_tx_claims where txid=$1",[proof.txid]);expect(claims.rows).toHaveLength(0);
  });
  it("requires staff authorization for an invoice assignment",async()=>{
    const p=await sharedInvoice(),proof=evidence(p.address);await record(p.id,proof);
    await expect(db.query("select ap_assign_shared_crypto_deposit('BEP20',$1,$2,$3)",[proof.txid,p.id,"Customer hash alone is not payer evidence"])).rejects.toThrow("Finance access");
  });
  it("cannot bypass the matching guard using a forged confirmed observation",async()=>{
    const a=await sharedInvoice(),b=await sharedInvoice(a.address),proof=evidence(a.address,{custodian_credit:true,custodian_deposit_id:"forged-match"});
    await db.query("insert into ap_crypto_observations(order_id,evidence,state) values($1,$2::jsonb,'confirmed')",[a.id,JSON.stringify(proof)]);
    await db.query("insert into ap_crypto_tx_claims(network,txid,order_id) values('BEP20',$1,$2)",[proof.txid,a.id]);
    await db.query("update ap_payment_orders set current_crypto_status='confirming',verified_transaction_hash=$1 where id=$2",[proof.txid,a.id]);
    await expect(db.query("select ap_activate_crypto_payment($1,$2,12)",[a.id,proof.txid])).rejects.toThrow("invoice assignment");expect((await state(b.id)).status).toBe("pending");
  });
});
