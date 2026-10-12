import {describe,it,expect,vi,afterEach} from "vitest";
import {matchesBinanceCredit,binanceRead,type BinanceDeposit} from "../lib/billing/reliable/binance";
import type {PaymentOrder,Observation} from "../lib/billing/reliable/domain";
vi.mock("server-only",()=>({}));
const order={crypto_asset:"USDT",crypto_network:"BEP20",receiving_address:"0xabc",token_decimals:6} as PaymentOrder;
const observation={txid:"0x123",amount:"49"} as Observation;
const deposit:BinanceDeposit={id:"deposit1",coin:"USDT",network:"BSC",address:"0xabc",txId:"123",amount:"49.000000",status:1,transferType:0,confirmTimes:"15/12",completeTime:12345,travelRuleStatus:0};
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe("Binance credit verification",()=>{
 it("matches credited deposits independently of customer hints",()=>{expect(matchesBinanceCredit(order,observation,deposit)).toBe(true);});
 it.each([0,2,6,7,8])("rejects status %s",status=>expect(matchesBinanceCredit(order,observation,{...deposit,status})).toBe(false));
 it.each([{network:"ETH"},{coin:"USDC"},{address:"0xdef"},{txId:"456"},{amount:"48"},{confirmTimes:"1/12"},{completeTime:0},{transferType:1},{travelRuleStatus:1}])("rejects mismatching or incomplete credit %j",override=>expect(matchesBinanceCredit(order,observation,{...deposit,...override})).toBe(false));
 it("blocks non-read-only endpoints before sending any request",async()=>{const fetch=vi.fn();vi.stubGlobal("fetch",fetch);await expect(binanceRead("/sapi/v1/capital/withdraw/apply")).rejects.toThrow("read-only");expect(fetch).not.toHaveBeenCalled();});
 it("signs server-side GET requests",async()=>{vi.stubEnv("BINANCE_READ_API_KEY","sample-key");vi.stubEnv("BINANCE_READ_API_SECRET","sample-secret");const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>[]});vi.stubGlobal("fetch",fetch);await binanceRead("/sapi/v1/capital/deposit/hisrec",{coin:"USDT"});const [url,options]=fetch.mock.calls[0];expect(String(url)).toMatch(/^https:\/\/api.binance.com\/sapi\/v1\/capital\/deposit\/hisrec\?/);expect(new URL(url).searchParams.get("signature")).toMatch(/^[a-f0-9]{64}$/);expect(options.method).toBe("GET");});
});
