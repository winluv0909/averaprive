import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
import type {PaymentOrder} from "../lib/billing/reliable/domain";
const f=vi.hoisted(()=>({rpc:vi.fn(),snapshot:vi.fn(),discover:vi.fn(),verify:vi.fn(),email:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({rpc:f.rpc})}));
vi.mock("../lib/billing/wallet/config",()=>({walletChannels:[],walletConfig:()=>({network:"ERC20",token:"token",decimals:6,addresses:["wallet"]})}));
vi.mock("../lib/billing/wallet/chain",()=>({walletSnapshot:f.snapshot,walletDiscover:f.discover,walletVerify:f.verify}));
vi.mock("../lib/billing/reliable/notifications",()=>({deliverNotifications:f.email}));
import {monitorWalletPayments} from "../lib/billing/wallet/monitor";
const order={id:"invoice",receiving_mode:"shared",receiving_provider:"wallet",crypto_asset:"USDT",crypto_network:"ERC20",token_contract:"token",token_decimals:6,receiving_address:"wallet",scan_cursor:"100",submitted_txid:null,verified_transaction_hash:null} as PaymentOrder & {submitted_txid:string|null};
beforeEach(()=>{f.snapshot.mockResolvedValue("100");f.discover.mockResolvedValue({txids:["first","second"],cursor:"110"});f.verify.mockResolvedValue([{txid:"first",network:"ERC20",token:"token",destination:"wallet",amount:"49"}]);f.email.mockResolvedValue({sent:0,failed:0});f.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="ap_claim_trust_wallet_monitor"?[order]:name==="ap_record_trust_wallet_evidence"?"confirmed":null}));});
afterEach(()=>vi.resetAllMocks());
describe("Wallet monitor",()=>{
 it("uses only the wallet queue and stops after confirmation",async()=>{expect((await monitorWalletPayments()).checked).toBe(1);expect(f.verify).toHaveBeenCalledTimes(1);expect(f.rpc.mock.calls.some(([name])=>name==="ap_claim_crypto_monitor")).toBe(false);});
 it("does not store approval evidence when an RPC verification fails",async()=>{f.verify.mockRejectedValue(new Error("offline"));expect((await monitorWalletPayments()).errors).toBe(1);expect(f.rpc.mock.calls.some(([name])=>name==="ap_record_trust_wallet_evidence")).toBe(false);const finish=f.rpc.mock.calls.find(([name])=>name==="ap_finish_crypto_monitor");expect(finish?.[1].next_cursor).toBe("110");expect(finish?.[1].error_note).toBeTruthy();});
 it("fails closed rather than skipping an overflowing transaction page",async()=>{f.discover.mockResolvedValue({txids:Array.from({length:101},(_,i)=>String(i)),cursor:"1000"});expect((await monitorWalletPayments()).errors).toBe(1);expect(f.verify).not.toHaveBeenCalled();expect(f.rpc.mock.calls.find(([name])=>name==="ap_finish_crypto_monitor")?.[1].error_note).toBeTruthy();});
});
