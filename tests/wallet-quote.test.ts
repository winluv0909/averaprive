import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {createCryptoQuote} from "../lib/billing/crypto-quote";
beforeEach(()=>vi.stubEnv("TATUM_API_KEY","test-price-key"));
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe("Crypto invoice quotes",()=>{
 it("uses the stated stablecoin reference without contacting a price API",async()=>{const fetch=vi.fn();vi.stubGlobal("fetch",fetch);expect((await createCryptoQuote("usdt",49)).cryptoAmount).toBe("49.00");expect(fetch).not.toHaveBeenCalled();});
 it("uses a fresh BTC/USD rate and preserves eight-decimal precision",async()=>{vi.stubGlobal("fetch",vi.fn(async()=>Response.json({value:"100000",symbol:"BTC",basePair:"USD",timestamp:Date.now()})));expect((await createCryptoQuote("bitcoin",49)).cryptoAmount).toMatch(/^0\.00049\d{3}$/);});
 it("rejects stale, future and missing timestamps",async()=>{for(const timestamp of [Date.now()-3600000,Date.now()+3600000,undefined]){vi.stubGlobal("fetch",vi.fn(async()=>Response.json({value:"100000",symbol:"BTC",basePair:"USD",timestamp})));await expect(createCryptoQuote("bitcoin",49)).rejects.toThrow("too old");}});
 it("rejects wrong currency and unavailable quotes",async()=>{vi.stubGlobal("fetch",vi.fn(async()=>Response.json({value:"100000",symbol:"BTC",basePair:"EUR",timestamp:Date.now()})));await expect(createCryptoQuote("bitcoin",49)).rejects.toThrow("base currency");vi.stubGlobal("fetch",vi.fn(async()=>new Response("",{status:503})));await expect(createCryptoQuote("bitcoin",49)).rejects.toThrow();});
});
