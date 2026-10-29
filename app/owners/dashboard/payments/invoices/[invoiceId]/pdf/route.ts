import {requireStaffRole} from "@/lib/auth/authorization";
import {createAdminClient} from "@/lib/supabase/admin";
import {invoicePdf,type Invoice} from "@/lib/billing/reliable/invoice";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{invoiceId:string}>}) {
  await requireStaffRole(["super_admin","finance"]);
  const {invoiceId}=await params;
  const {data,error}=await createAdminClient().from("ap_invoices").select("*").eq("id",invoiceId).single();
  if(error||!data) return Response.json({error:"Invoice not found"},{status:404});
  const filename=String(data.invoice_number).replace(/[^A-Za-z0-9_-]/g,"_");
  return new Response(new Uint8Array(invoicePdf(data as Invoice)),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${filename}.pdf"`,"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow","X-Content-Type-Options":"nosniff"}});
}
