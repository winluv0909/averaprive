import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {walletDiscover} from "../lib/billing/wallet/chain";
import type {PaymentOrder} from "../lib/billing/reliable/domain";
const order={crypto_asset:"USDT",crypto_network:"ERC20",receiving_address:"0x7a71cfbdc7d37d9520445bff3634cbda889f904d",scan_cursor:"100"} as PaymentOrder;
beforeEach(()=>{vi.stubEnv("WALLET_CRYPTO_ENABLED","true");vi.stubEnv("CRYPTO_MONITOR_SECRET","s".repeat(32));vi.stubEnv("WALLET_RPC_ERC20","https://eth.example");});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe("Alchemy free-tier deposit scanning",()=>{
 it("finds deposits across pages without exceeding ten blocks and advances beyond the overlap",async()=>{const ranges:Array<{fromBlock:string;toBlock:string}>=[];vi.stubGlobal("fetch",vi.fn(async(_url:string,args:{body:string})=>{const {method,params}=JSON.parse(args.body);if(method==="eth_blockNumber")return Response.json({result:"0x7d"});ranges.push(params[0]);expect(BigInt(params[0].toBlock)-BigInt(params[0].fromBlock)+BigInt(1)).toBeLessThanOrEqual(BigInt(10));return Response.json({result:[{transactionHash:ranges.length===3?"later":"earlier"},{transactionHash:"removed",removed:true}]});}));const result=await walletDiscover(order);expect(result.cursor).toBe("125");expect(result.txids.sort()).toEqual(["earlier","later"]);expect(ranges).toHaveLength(4);});
 it("does not return a new cursor when a later page fails",async()=>{let calls=0;vi.stubGlobal("fetch",vi.fn(async(_url:string,args:{body:string})=>{const {method}=JSON.parse(args.body);if(method==="eth_blockNumber")return Response.json({result:"0x7d"});calls++;return Response.json(calls===2?{error:{message:"rate limited"}}:{result:[]});}));await expect(walletDiscover(order)).rejects.toThrow("RPC");expect(order.scan_cursor).toBe("100");});
 it("bounds backlog scans while making forward progress",async()=>{let pages=0;vi.stubGlobal("fetch",vi.fn(async(_url:string,args:{body:string})=>{const {method}=JSON.parse(args.body);if(method==="eth_blockNumber")return Response.json({result:"0x1000"});pages++;return Response.json({result:[]});}));expect((await walletDiscover(order)).cursor).toBe("285");expect(pages).toBe(20);});
});
