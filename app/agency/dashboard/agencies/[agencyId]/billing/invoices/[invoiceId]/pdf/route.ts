import {requireAgencyRole} from "@/lib/auth/authorization";
import {createAdminClient} from "@/lib/supabase/admin";
import {invoicePdf,type Invoice} from "@/lib/billing/reliable/invoice";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{agencyId:string;invoiceId:string}>}) {
  const {agencyId,invoiceId}=await params;
  await requireAgencyRole(agencyId,["owner","admin","billing"]);
  const {data,error}=await createAdminClient().from("ap_invoices").select("*").eq("agency_id",agencyId).eq("id",invoiceId).single();
  if(error) return Response.json({error:"Invoice not found"},{status:404});
  const filename=String(data.invoice_number).replace(/[^A-Za-z0-9_-]/g,"_");
  return new Response(new Uint8Array(invoicePdf(data as Invoice)),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${filename}.pdf"`,"Cache-Control":"private, no-store"}});
}
