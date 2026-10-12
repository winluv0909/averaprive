import {afterEach,describe,it,expect,vi} from "vitest";
const runner=vi.hoisted(()=>vi.fn(async()=>({checked:0,errors:0,email:{sent:0,failed:0}})));
vi.mock("@/lib/billing/wallet/monitor",()=>({monitorWalletPayments:runner}));
import {POST} from "../app/api/internal/crypto-monitor/route";
afterEach(()=>{vi.unstubAllEnvs();runner.mockClear();});
describe("payment worker authorization",()=>{
  it("refuses unconfigured worker secrets",async()=>{vi.stubEnv("CRYPTO_MONITOR_SECRET","");expect((await POST(new Request("https://site.example/api/internal/crypto-monitor",{method:"POST"}))).status).toBe(503);expect(runner).not.toHaveBeenCalled();});
  it("refuses incorrect bearer token before accessing payment records",async()=>{vi.stubEnv("CRYPTO_MONITOR_SECRET","s".repeat(32));expect((await POST(new Request("https://site.example/api/internal/crypto-monitor",{method:"POST",headers:{Authorization:"Bearer "+"x".repeat(32)}}))).status).toBe(401);expect(runner).not.toHaveBeenCalled();});
  it("keeps wallet processing disabled until explicitly enabled",async()=>{const secret="s".repeat(32);vi.stubEnv("CRYPTO_MONITOR_SECRET",secret);expect((await POST(new Request("https://site.example/api/internal/crypto-monitor",{method:"POST",headers:{Authorization:`Bearer ${secret}`}}))).status).toBe(503);expect(runner).not.toHaveBeenCalled();});
  it("runs the wallet monitor with valid authorization and an enabled checkout",async()=>{const secret="s".repeat(32);vi.stubEnv("CRYPTO_MONITOR_SECRET",secret);vi.stubEnv("WALLET_CRYPTO_ENABLED","true");expect((await POST(new Request("https://site.example/api/internal/crypto-monitor",{method:"POST",headers:{Authorization:`Bearer ${secret}`}}))).status).toBe(200);expect(runner).toHaveBeenCalledOnce();});
});
