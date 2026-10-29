import {beforeEach,describe,expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
const f=vi.hoisted(()=>({role:"super_admin",signedIn:true,found:true,db:vi.fn(),pdf:vi.fn(()=>Buffer.from("%PDF-1.4 test"))}));
vi.mock("server-only",()=>({}));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw new Error(`redirect:${path}`)},notFound:()=>{throw new Error("not-found")}}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:f.signedIn?{id:"user",email:"owner@example.invalid",app_metadata:{}}:null}})},from:()=>({select:()=>({eq:async()=>({data:[{role:f.role}],error:null})})})})}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>{f.db();const q={select:()=>q,eq:()=>q,single:async()=>({data:f.found?{id:"invoice",invoice_number:"AP/TEST",order_id:"order",status:"paid",currency:"USD",subtotal:49,tax_amount:0,total_amount:49,issued_at:"2026-10-29",paid_at:null,seller_snapshot:{name:"Avera Privé"},customer_snapshot:{legal_name:"QA agency"},payment_snapshot:{provider:"paypal",environment:"sandbox"},line_items:[]}:null,error:null})};return{from:()=>q};}}));
vi.mock("@/lib/billing/reliable/invoice",()=>({invoicePdf:f.pdf}));
vi.mock("@/app/dashboard/_components/portal-shells",()=>({OwnerOperationsShell:({children}:{children:React.ReactNode})=>children}));
import Page from "@/app/owners/dashboard/payments/invoices/[invoiceId]/page";
import {GET} from "@/app/owners/dashboard/payments/invoices/[invoiceId]/pdf/route";
const context=()=>({params:Promise.resolve({invoiceId:"invoice"})});
beforeEach(()=>{f.role="super_admin";f.signedIn=true;f.found=true;f.db.mockClear();f.pdf.mockClear();});
describe("owner invoice access",()=>{
 it.each(["super_admin","finance"])("allows %s to view and download an existing invoice",async role=>{f.role=role;const html=renderToStaticMarkup(await Page(context()));expect(html).toContain("Invoice review");expect(html).toContain("Sandbox test invoice");expect(html).toContain('/owners/dashboard/payments/invoices/invoice/pdf');expect(html).not.toContain('/agency/dashboard');const response=await GET(new Request('http://localhost'),context());expect(response.headers.get('Cache-Control')).toBe('private, no-store');expect(response.headers.get('Content-Disposition')).toContain('AP_TEST.pdf');expect(await response.text()).toContain('%PDF');});
 it.each(["moderator","support","verification_reviewer","owner"])("blocks %s before accessing invoices",async role=>{f.role=role;await expect(Page(context())).rejects.toThrow('redirect:/forbidden');await expect(GET(new Request('http://localhost'),context())).rejects.toThrow('redirect:/forbidden');expect(f.db).not.toHaveBeenCalled();expect(f.pdf).not.toHaveBeenCalled();});
 it("requires sign-in before accessing invoices",async()=>{f.signedIn=false;await expect(Page(context())).rejects.toThrow('redirect:/owners/login');await expect(GET(new Request('http://localhost'),context())).rejects.toThrow('redirect:/owners/login');expect(f.db).not.toHaveBeenCalled();});
 it("returns not found for absent invoices without generating a PDF",async()=>{f.found=false;await expect(Page(context())).rejects.toThrow('not-found');expect((await GET(new Request('http://localhost'),context())).status).toBe(404);expect(f.pdf).not.toHaveBeenCalled();});
});
