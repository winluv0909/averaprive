import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
let db: PGlite;
const agency = "10000000-0000-4000-8000-000000000001", user = "20000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema ap_private;
    create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select '20000000-0000-4000-8000-000000000001'::uuid$$;
    create function ap_private.has_agency_role(uuid,text[]) returns boolean language sql as $$select true$$;
    create function ap_private.is_staff(text[]) returns boolean language sql as $$select coalesce(current_setting('test.owner',true),'false')='true'$$;
    create table ap_agencies(id uuid primary key);create table ap_plans(code text primary key,name text,active boolean,monthly_price_usd numeric,annual_price_usd numeric);
    create table ap_agency_memberships(agency_id uuid,user_id uuid,role text,status text);create table ap_staff_roles(user_id uuid,role text);
    create table ap_subscriptions(id uuid primary key default gen_random_uuid(),agency_id uuid unique,plan_code text,status text,current_period_started_at timestamptz,current_period_ends_at timestamptz,commercial_reference text,cancel_at_period_end boolean,updated_at timestamptz);
    create table ap_security_audit(actor_user_id uuid,agency_id uuid,action text,target_type text,target_id text,metadata jsonb);
    insert into auth.users values('${user}');insert into ap_agencies values('${agency}');insert into ap_plans values('prive','Prive',true,49,490);
    insert into ap_agency_memberships values('${agency}','${user}','owner','active');`);
  for (const file of ["202610080017_crypto_billing.sql", "202610110021_reliable_crypto_payments.sql", "202610110022_binance_credit_verification.sql", "202610110023_shared_binance_checkout.sql", "202610110024_paypal_checkout.sql", "202610120025_trust_wallet_checkout.sql"]) await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await db.exec(readFileSync("database/step-08-install.sql","utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });

async function create(overrides: Record<string,unknown> = {}) {
 const input = {checkout_request_id:randomUUID(),agency_id:agency,created_by:user,plan_code:"prive",billing_cycle:"monthly",payer_company_name:"Example agency",payer_full_name:"Example owner",payer_email:"owner@example.com",payer_billing_address:"Example street address",crypto_asset:"USDT",crypto_network:"ERC20",token_contract:"0xdac17f958d2ee523a2206206994597c13d831ec7",token_decimals:6,required_confirmations:12,total_amount:"49",expected_crypto_amount:"49",scan_cursor:"100",payment_expires_at:new Date(Date.now()+1800000).toISOString(),quoted_at:new Date().toISOString(),usd_rate:"1",receiving_provider:"wallet",...overrides};
 const result=await db.query<{record:{order_id:string}}>("select ap_create_trust_wallet_invoice($1::jsonb,$2::jsonb,'{}'::jsonb) record",[JSON.stringify(input),JSON.stringify([input.crypto_network==="BITCOIN"?"bc1qyxpxwhmd8w39xndgnvu9wfq6d57sa7t7u9c42h":input.crypto_network==="TRC20"?"TQmrKedVwf3yfvmLUcsPbnWsWHFkSFVZnq":"0x7a71cfbdc7d37d9520445bff3634cbda889f904d"])]);
 return {id:result.rows[0].record.order_id,input};
}
async function proof(id:string, overrides:Record<string,unknown>={}) {
 const q=await db.query<Record<string,unknown>>("select *,expected_crypto_amount::text exact from ap_payment_orders where id=$1",[id]);const p=q.rows[0];
 return {network:p.crypto_network,txid:"0x"+randomUUID().replaceAll("-","").padEnd(64,"0"),token:p.token_contract,destination:p.receiving_address,amount:p.exact,confirmations:p.required_confirmations,finalized:true,successful:true,block_hash:"independent-block",block_number:"150",transaction_at:new Date().toISOString(),...overrides};
}
async function lease(id:string) {const worker=randomUUID();await db.query("update ap_payment_orders set monitor_worker=$2,monitor_lock_until=now()+interval '10 minutes' where id=$1",[id,worker]);return worker;}
async function record(id:string,evidence:Record<string,unknown>) { const worker=await lease(id);return db.query<{state:string}>("select ap_record_trust_wallet_evidence($1,$2,$3::jsonb) state",[id,worker,JSON.stringify(evidence)]); }

async function exception(amount="48", overrides:Record<string,unknown>={}) {
 const p=await create(); const e=await proof(p.id,{amount,...overrides});
 await db.query("select ap_submit_trust_wallet_hint($1,$2)",[p.id,e.txid]); await record(p.id,e);
 const q=await db.query<{id:string}>("select id from ap_payment_exceptions where order_id=$1 and txid=$2",[p.id,e.txid]);
 return {...p,e,exceptionId:q.rows[0].id};
}
const note="Payer identity and transaction ownership checked through support.";
async function open(id:string) {return db.query<{id:string}>("select ap_open_crypto_refund($1,$2) id",[id,note]);}
async function owner(enabled=true) {await db.query("select set_config('test.owner',$1,false)",[String(enabled)]);}
describe("refund and retry database workflow",()=>{
 it("denies agency and finance-only accounts",async()=>{await owner(false);const p=await exception();await expect(open(p.exceptionId)).rejects.toThrow("Owner access");});
 it("cancels and voids an underpaid invoice without activating or extending a plan",async()=>{
  await owner(false);const p=await exception();const before=await db.query("select * from ap_subscriptions");await owner();const result=await open(p.exceptionId);
  expect((await open(p.exceptionId)).rows[0].id).toBe(result.rows[0].id);
  expect((await db.query<{status:string}>("select status from ap_payment_orders where id=$1",[p.id])).rows[0].status).toBe("cancelled");
  expect((await db.query<{status:string}>("select status from ap_invoices where order_id=$1",[p.id])).rows[0].status).toBe("void");
  expect((await db.query("select * from ap_subscriptions")).rows).toEqual(before.rows);
  const w=await lease(p.id);expect((await db.query<{state:string}>("select ap_record_trust_wallet_evidence($1,$2,$3::jsonb) state",[p.id,w,JSON.stringify(p.e)])).rows[0].state).not.toBe("confirmed");
  expect((await db.query<{status:string}>("select status from ap_payment_orders where id=$1",[p.id])).rows[0].status).toBe("cancelled");
 });
 it("supports finalized overpayments and exact late payments",async()=>{for(const type of ["over","late"]){await owner(false);const p=await create();const e=await proof(p.id,type==="over"?{amount:"999"}:{transaction_at:new Date(Date.now()+3600000).toISOString()});await db.query("select ap_submit_trust_wallet_hint($1,$2)",[p.id,e.txid]);await record(p.id,e);const q=await db.query<{id:string}>("select id from ap_payment_exceptions where order_id=$1",[p.id]);await owner();expect((await open(q.rows[0].id)).rows[0].id).toBeTruthy();}});
 it("rejects unfinalized deposits",async()=>{await owner(false);const p=await exception("47",{finalized:false,confirmations:1});await owner();await expect(open(p.exceptionId)).rejects.toThrow("Finalized");});
 it("rejects a deposit claimed by a different invoice",async()=>{await owner(false);const p=await exception("46"),other=await create();await db.query("insert into ap_crypto_tx_claims(network,txid,order_id) values($1,$2,$3)",[p.e.network,p.e.txid,other.id]);await owner();await expect(open(p.exceptionId)).rejects.toThrow("another invoice");});
 it("rejects a deposit whose exact amount belongs to another invoice",async()=>{await owner(false);const other=await create();const q=await db.query<{value:string}>("select expected_crypto_amount::text value from ap_payment_orders where id=$1",[other.id]);const p=await exception("45");await db.query("update ap_shared_crypto_deposits set evidence=jsonb_set(evidence,'{amount}',to_jsonb($1::text)) where txid=$2",[q.rows[0].value,p.e.txid]);await owner();await expect(open(p.exceptionId)).rejects.toThrow("another invoice");});
 it("records a full outgoing refund once, rejects partial and incoming hashes, and preserves audit history",async()=>{
  await owner(false);const p=await exception("44");await owner();const id=(await open(p.exceptionId)).rows[0].id;const tx="0x"+"b".repeat(64),dest="0x"+"c".repeat(40);
  const save=(hash=tx,amount="44",memo=note)=>db.query("select ap_record_crypto_refund($1,$2,$3,$4,$5)",[id,hash,amount,dest,memo]);
  await expect(save(tx,"43")).rejects.toThrow("full deposit");await expect(save(p.e.txid)).rejects.toThrow("outgoing");
  await save();await save();await expect(save(tx,"44",note+" edited")).rejects.toThrow("cannot be overwritten");
  expect((await db.query<{state:string}>("select state from ap_crypto_refund_cases where id=$1",[id])).rows[0].state).toBe("refund_recorded");
  expect((await db.query("select * from ap_security_audit where action='payment.refund_recorded' and target_id=$1",[id])).rows).toHaveLength(1);
  expect((await db.query<{status:string}>("select status from ap_payment_orders where id=$1",[p.id])).rows[0].status).toBe("cancelled");
 });
 it("rejects paid invoices and empty ownership notes",async()=>{
  await owner(false);const p=await exception("43");await owner();
  await expect(db.query("select ap_open_crypto_refund($1,null)",[p.exceptionId])).rejects.toThrow("ownership evidence");
  await db.query("update ap_payment_orders set status='paid' where id=$1",[p.id]);await expect(open(p.exceptionId)).rejects.toThrow("unpaid");
 });
 it("requires owner access to record refunds and prevents outgoing TXID reuse",async()=>{
  await owner(false);const a=await exception("42"),b=await exception("41");await owner();const x=(await open(a.exceptionId)).rows[0].id,y=(await open(b.exceptionId)).rows[0].id;
  const hash="0x"+"d".repeat(64),dest="0x"+"e".repeat(40);
  const save=(id:string,amount:string)=>db.query("select ap_record_crypto_refund($1,$2,$3,$4,$5)",[id,hash,amount,dest,note]);
  await owner(false);await expect(save(x,"42")).rejects.toThrow("Owner access");await owner();await save(x,"42");
  await expect(save(y,"41")).rejects.toThrow("unique");
  expect((await db.query<{state:string}>("select state from ap_crypto_refund_cases where id=$1",[y])).rows[0].state).toBe("refund_required");
 });
 it("blocks direct client table writes and anonymous function execution",async()=>{
  const q=await db.query("select has_table_privilege('authenticated','ap_crypto_refund_cases','INSERT') allowed,has_function_privilege('anon','ap_open_crypto_refund(uuid,text)','EXECUTE') anon_allowed,relrowsecurity from pg_class where oid='ap_crypto_refund_cases'::regclass");
  expect(q.rows[0]).toMatchObject({allowed:false,anon_allowed:false,relrowsecurity:true});
 });
});
