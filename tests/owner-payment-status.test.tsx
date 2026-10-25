import {afterEach,describe,expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth/authorization",()=>({requireStaffRole:async()=>({user:{email:"owner@example.com"}})}));
vi.mock("@/app/dashboard/_components/portal-shells",()=>({OwnerOperationsShell:({children}:{children:React.ReactNode})=>children}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({from:()=>{const query:Record<string,unknown>={};for(const method of ["select","in","order","neq"])query[method]=()=>query;query.limit=async()=>({data:[],error:null});return query;}})}));
import PaymentsPage from "@/app/owners/dashboard/payments/page";
afterEach(()=>vi.unstubAllEnvs());
describe("owner crypto availability",()=>{
 it("shows unavailable checkout when disabled",async()=>{vi.stubEnv("WALLET_CRYPTO_ENABLED","false");const html=renderToStaticMarkup(await PaymentsPage());expect(html).toContain("Crypto checkout is unavailable");expect(html).not.toContain("Crypto processing disabled");});
 it("uses checkout configuration readiness and distinguishes monitor health",async()=>{vi.stubEnv("WALLET_CRYPTO_ENABLED","true");vi.stubEnv("CRYPTO_MONITOR_SECRET","s".repeat(32));vi.stubEnv("WALLET_RPC_TRC20","https://tron.example.com");const html=renderToStaticMarkup(await PaymentsPage());expect(html).toMatch(/configured for [1-7] payment channels/);expect(html).toContain("does not confirm that the scheduled monitor is running");expect(html).toContain("A submitted transaction hash or a review note cannot activate a plan");});
 it("does not advertise a channel with missing verification configuration",async()=>{vi.stubEnv("WALLET_CRYPTO_ENABLED","true");vi.stubEnv("CRYPTO_MONITOR_SECRET","");const html=renderToStaticMarkup(await PaymentsPage());expect(html).toContain("Crypto checkout is unavailable");});
});
