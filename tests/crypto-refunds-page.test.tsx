import {beforeEach,describe,expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
const f=vi.hoisted(()=>({recorded:false}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth/authorization",()=>({requireAgencyRole:async()=>({user:{email:"payer@example.com"}})}));
vi.mock("@/app/dashboard/_components/portal-shells",()=>({AgencyWorkspaceShell:({children}:{children:React.ReactNode})=>children}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({from:(table:string)=>{const result=()=>({data:table==="ap_payment_orders"?{id:"order",provider:"crypto",wallet_generation:"trust_wallet_v1",status:"cancelled",crypto_asset:"USDT",crypto_network:"ERC20"}:{id:"invoice",invoice_number:"AP-TEST",payment_snapshot:{refund_case_id:"case",refund_status:f.recorded?"refund_recorded":"refund_required",refund_amount:"48",refund_txid:"outgoing-hash"}}});const query={select:()=>query,eq:()=>query,single:async()=>result(),maybeSingle:async()=>result()};return query;}})}));
vi.mock("qrcode",()=>({default:{toDataURL:vi.fn(()=>{throw new Error("Cancelled invoices must not generate a payment QR");})}}));
import PaymentPage from "@/app/dashboard/agencies/[agencyId]/billing/payments/[orderId]/page";
beforeEach(()=>{f.recorded=false;});
async function html(){return renderToStaticMarkup(await PaymentPage({params:Promise.resolve({agencyId:"agency",orderId:"order"}),searchParams:Promise.resolve({})}));}
describe("customer refund state",()=>{
 it("hides payment instructions and asks the customer to wait",async()=>{const result=await html();expect(result).toContain("Refund in progress");expect(result).toContain("Do not send another payment");expect(result).not.toContain("Scan with your wallet");expect(result).not.toContain("Save transaction hint");expect(result).toContain("Wait for the refund");});
 it("shows the owner-recorded outgoing reference without claiming independently verified receipt",async()=>{f.recorded=true;const result=await html();expect(result).toContain("Refund transfer recorded");expect(result).toContain("outgoing-hash");expect(result).toContain("confirm it has arrived");expect(result).toContain("After receiving the refund");});
});
