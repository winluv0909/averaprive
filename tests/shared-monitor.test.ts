import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
import type {PaymentOrder} from "../lib/billing/reliable/domain";
const f=vi.hoisted(()=>({rpc:vi.fn(),snapshot:vi.fn(),discover:vi.fn(),verify:vi.fn(),credit:vi.fn(),email:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({rpc:f.rpc})}));
vi.mock("../lib/billing/reliable/chain",()=>({snapshotChain:f.snapshot,discover:f.discover,verifyTransaction:f.verify}));
vi.mock("../lib/billing/reliable/config",()=>({pairs:["USDT_BEP20"],pairConfig:()=>({network:"BEP20",token:"token",decimals:6,addresses:["wallet"]})}));
vi.mock("../lib/billing/reliable/binance",()=>({verifyBinanceCredit:f.credit}));
vi.mock("../lib/billing/reliable/notifications",()=>({deliverNotifications:f.email}));
import {monitorPayments} from "../lib/billing/reliable/monitor";
const make=(n:number)=>({id:String(n),receiving_mode:"shared",receiving_provider:"binance",crypto_asset:"USDT",crypto_network:"BEP20",token_contract:"token",token_decimals:6,receiving_address:"wallet",scan_cursor:"100",created_at:"2026-10-11T00:00:00Z",submitted_txid:null,verified_transaction_hash:null} as PaymentOrder & {submitted_txid:string|null});
beforeEach(()=>{f.snapshot.mockResolvedValue("100");f.discover.mockResolvedValue({txids:["tx"],cursor:"110"});f.verify.mockResolvedValue([{txid:"tx",network:"BEP20",token:"token",destination:"wallet",amount:"49"}]);f.credit.mockResolvedValue({custodian_credit:true,custodian_deposit_id:"credit"});f.email.mockResolvedValue({sent:0,failed:0});});
afterEach(()=>vi.resetAllMocks());
describe("concurrent shared payment monitoring",()=>{
 it("reuses read-only lookups while checking every invoice independently",async()=>{
  const orders=Array.from({length:12},(_,i)=>make(i));f.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="ap_claim_crypto_monitor"?orders:name==="ap_record_crypto_evidence"?"matching_review":null}));
  const result=await monitorPayments();expect(result.checked).toBe(12);expect(result.errors).toBe(0);
  expect(f.snapshot).toHaveBeenCalledTimes(1);expect(f.discover).toHaveBeenCalledTimes(1);expect(f.verify).toHaveBeenCalledTimes(1);expect(f.credit).toHaveBeenCalledTimes(1);
  const recorded=f.rpc.mock.calls.filter(([name])=>name==="ap_record_crypto_evidence");expect(recorded).toHaveLength(12);expect(new Set(recorded.map(([,args])=>args.target_order)).size).toBe(12);
 });
 it("stops checking more transactions after an invoice is confirmed",async()=>{
  f.discover.mockResolvedValue({txids:["first","second"],cursor:"110"});f.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="ap_claim_crypto_monitor"?[make(1)]:name==="ap_record_crypto_evidence"?"confirmed":null}));
  await monitorPayments();expect(f.verify).toHaveBeenCalledTimes(1);
 });
 it("does not reuse discovery results for different receiving addresses",async()=>{
  const a=make(1),b={...make(2),receiving_address:"other-wallet"};f.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="ap_claim_crypto_monitor"?[a,b]:null}));await monitorPayments();expect(f.discover).toHaveBeenCalledTimes(2);
 });
 it("never approves payment when Binance verification is unavailable",async()=>{
  f.credit.mockRejectedValue(new Error("Binance unavailable"));f.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="ap_claim_crypto_monitor"?[make(1),make(2)]:null}));const result=await monitorPayments();expect(result.errors).toBe(2);expect(f.rpc.mock.calls.some(([name])=>name==="ap_record_crypto_evidence")).toBe(false);
  const finishes=f.rpc.mock.calls.filter(([name])=>name==="ap_finish_crypto_monitor");expect(finishes).toHaveLength(2);expect(finishes.every(([,args])=>args.error_note)).toBe(true);
 });
});
