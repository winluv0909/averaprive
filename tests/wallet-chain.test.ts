import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
import { bitcoinAddressValid, bitcoinReceiver, walletChannels, walletConfig } from "../lib/billing/wallet/config";
import { bitcoinGenesis, bitcoinSnapshot, verifyBitcoin } from "../lib/billing/wallet/bitcoin";
import { tronHex } from "../lib/billing/reliable/config";
import { walletSnapshot } from "../lib/billing/wallet/chain";
import type { PaymentOrder } from "../lib/billing/reliable/domain";
const hash="a".repeat(64), block="b".repeat(64);
const order={crypto_asset:"BTC",crypto_network:"BITCOIN",receiving_address:bitcoinReceiver,created_at:new Date(Date.now()-100000).toISOString()} as PaymentOrder;
const make=(confirmed=true)=>({txid:hash,vin:[{prevout:{scriptpubkey_address:"different-customer-address"}}],vout:[{scriptpubkey_address:bitcoinReceiver,value:49000}],status:confirmed?{confirmed:true,block_height:100,block_hash:block,block_time:Math.floor(Date.now()/1000)}:{confirmed:false}});
beforeEach(()=>{vi.stubEnv("WALLET_CRYPTO_ENABLED","true");vi.stubEnv("CRYPTO_MONITOR_SECRET","s".repeat(32));vi.stubEnv("TATUM_API_KEY","test");vi.stubEnv("WALLET_RPC_BITCOIN","https://primary.example/api");vi.stubEnv("WALLET_BTC_SECONDARY_URL","https://secondary.example/api");});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
function mockBitcoin(tx=make(),head=105,canonical=block){vi.stubGlobal("fetch",vi.fn(async(url:string)=>{const path=new URL(url).pathname;return path.endsWith("/block-height/0")?new Response(bitcoinGenesis):path.includes("/tx/")?Response.json(tx):path.endsWith("/blocks/tip/height")?new Response(String(head)):new Response(canonical);}));}
describe("Wallet payment configuration and chain proof",()=>{
 it("has only the seven requested channels with valid receiving and token address encodings",()=>{expect(walletChannels).toHaveLength(7);expect(bitcoinAddressValid(bitcoinReceiver)).toBe(true);expect(bitcoinAddressValid(bitcoinReceiver.slice(0,-1)+"q")).toBe(false);for(const c of walletChannels.filter(c=>c.network==="TRC20")){expect(tronHex(c.token)).toHaveLength(40);expect(tronHex(c.address)).toHaveLength(40);}});
 it("requires two independent Bitcoin endpoints",()=>{vi.stubEnv("WALLET_BTC_SECONDARY_URL","https://primary.example/other");expect(()=>walletConfig("BTC","BITCOIN")).toThrow("independent");});
 it("rejects the wrong Bitcoin genesis",async()=>{vi.stubGlobal("fetch",vi.fn(async()=>new Response("wrong-genesis")));await expect(bitcoinSnapshot()).rejects.toThrow("mainnet");});
 it("verifies native Bitcoin recipient, amount and six confirmations",async()=>{mockBitcoin();const [proof]=await verifyBitcoin(order,hash);expect(proof.amount).toBe("0.00049000");expect(proof.confirmations).toBe(6);expect(proof.finalized).toBe(true);});
 it("does not approve broadcast-only or insufficiently confirmed Bitcoin",async()=>{mockBitcoin(make(false));expect((await verifyBitcoin(order,hash))[0].finalized).toBe(false);mockBitcoin(make(),101);expect((await verifyBitcoin(order,hash))[0].confirmations).toBe(2);expect((await verifyBitcoin(order,hash))[0].finalized).toBe(false);});
 it("rejects a reorg or missing transaction",async()=>{mockBitcoin(make(),105,"different-block");expect(await verifyBitcoin(order,hash)).toHaveLength(0);vi.stubGlobal("fetch",vi.fn(async()=>new Response("",{status:404})));expect(await verifyBitcoin(order,hash)).toHaveLength(0);});
 it("refuses disagreement between Bitcoin sources",async()=>{vi.stubGlobal("fetch",vi.fn(async(url:string)=>Response.json({...make(),vout:[{scriptpubkey_address:bitcoinReceiver,value:url.includes("primary")?49000:50000}]})));await expect(verifyBitcoin(order,hash)).rejects.toThrow("disagree");});
 it("does not count receiving-wallet change or unrelated destinations",async()=>{mockBitcoin({...make(),vin:[{prevout:{scriptpubkey_address:bitcoinReceiver}}]});expect(await verifyBitcoin(order,hash)).toHaveLength(0);mockBitcoin({...make(),vout:[{scriptpubkey_address:"other",value:49000}]});expect(await verifyBitcoin(order,hash)).toHaveLength(0);});
 it("sums multiple outputs to the same Bitcoin recipient in one transaction",async()=>{mockBitcoin({...make(),vout:[{scriptpubkey_address:bitcoinReceiver,value:40000},{scriptpubkey_address:bitcoinReceiver,value:9000}]});expect((await verifyBitcoin(order,hash))[0].amount).toBe("0.00049000");});
 it("fails closed on a wrong EVM chain or unsupported finalized blocks",async()=>{vi.stubEnv("WALLET_RPC_BASE","https://base.example");const config=walletConfig("USDC","BASE");vi.stubGlobal("fetch",vi.fn(async()=>Response.json({result:"0x1"})));await expect(walletSnapshot(config)).rejects.toThrow("Wrong blockchain");vi.stubGlobal("fetch",vi.fn(async(_url:string,args:{body:string})=>{const {method}=JSON.parse(args.body);return Response.json({result:method==="eth_chainId"?"0x2105":method==="eth_call"?"0x6":null});}));await expect(walletSnapshot(config)).rejects.toThrow("finalized");});
});
