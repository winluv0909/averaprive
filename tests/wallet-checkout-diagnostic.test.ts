import {beforeEach,describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
const f=vi.hoisted(()=>({lookup:{data:null,error:null} as {data:null;error:null|{code:string;message:string}},rpc:vi.fn(),quote:vi.fn(),snapshot:vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({from:()=>{const query={select:()=>query,eq:()=>query,maybeSingle:async()=>f.lookup,single:async()=>({data:{name:"Prive",monthly_price_usd:49,annual_price_usd:490},error:null})};return query;},rpc:f.rpc})}));
vi.mock("../lib/billing/wallet/config",()=>({walletConfig:()=>({asset:"USDT",network:"ERC20",token:"token",decimals:6,confirmations:12,addresses:["wallet"]})}));
vi.mock("../lib/billing/wallet/chain",()=>({walletSnapshot:f.snapshot}));
vi.mock("../lib/billing/crypto-quote",()=>({createCryptoQuote:f.quote}));
import {prepareWalletCheckout} from "../lib/billing/wallet/service";
const input={request_id:"request",agency_id:"agency",created_by:"user",plan_code:"prive",billing_cycle:"monthly",legal_name:"Example",billing_email:"example@example.com",billing_address:"Example address",crypto_asset:"USDT",crypto_network:"ERC20"};
beforeEach(()=>{f.lookup={data:null,error:null};f.quote.mockReset().mockResolvedValue({cryptoAmount:"49",usdRate:"1",expiresAt:"expiry",quotedAt:"quote",rateSource:"reference"});f.snapshot.mockReset().mockResolvedValue("100");f.rpc.mockReset().mockResolvedValue({data:{order_id:"created"},error:null});});
describe("Safe crypto checkout diagnostics",()=>{
 it("identifies schema lookup failure without exposing database details",async()=>{f.lookup.error={code:"42703",message:"SECRET database details"};await expect(prepareWalletCheckout(input)).rejects.toMatchObject({reference:"WC_LOOKUP_42703",reason:"Database request failed; report this reference to billing support"});});
 it("identifies invoice-save errors and whitelists validation explanations",async()=>{f.rpc.mockResolvedValue({data:null,error:{code:"P0001",message:"Token, network or receiving wallet mismatch"}});await expect(prepareWalletCheckout(input)).rejects.toMatchObject({reference:"WC_SAVE_P0001",reason:"Receiving configuration does not match migration 025"});});
 it("does not expose a price-service URL or API key",async()=>{f.quote.mockRejectedValue(new Error("https://example.com/SECRET-API-KEY"));await expect(prepareWalletCheckout(input)).rejects.toMatchObject({reference:"WC_QUOTE"});try{await prepareWalletCheckout(input);}catch(error){expect(String(error)).not.toContain("SECRET");}});
 it("keeps successful invoice creation unchanged",async()=>{expect(await prepareWalletCheckout(input)).toEqual({id:"created"});});
});
