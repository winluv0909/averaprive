import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { invoiceLines, invoicePdf, type Invoice } from "./invoice";
interface Notice {id:string;order_id:string;kind:string;recipient:string|null;event:string;attempts:number;}
export async function deliverNotifications() {
  const db=createAdminClient();
  const claimed=await db.rpc("ap_claim_payment_notifications",{batch_size:5});
  if(claimed.error) throw new Error("Payment notification queue unavailable");
  let sent=0,failed=0;
  for(const notice of (claimed.data||[]) as Notice[]) {
    try {
      const apiKey=process.env.RESEND_API_KEY,from=process.env.PAYMENT_EMAIL_FROM;
      const to=notice.kind==="customer"?[notice.recipient||""]:(process.env.PAYMENT_ADMIN_EMAILS||"").split(",").map(v=>v.trim()).filter(Boolean);
      if(!apiKey || !from || !to.length || to.some(v=>!v.includes("@"))) throw new Error("Configure transactional email sender and recipients");
      const invoiceResult=await db.from("ap_invoices").select("*").eq("order_id",notice.order_id).single();
      const orderResult=await db.from("ap_payment_orders").select("*").eq("id",notice.order_id).single();
      if(invoiceResult.error || orderResult.error) throw new Error("Invoice unavailable");
      const invoice=invoiceResult.data as Invoice;
      if(orderResult.data.provider === "paypal" && orderResult.data.paypal_environment === "sandbox") throw new Error("Sandbox notices must not be emailed as real receipts");
      if(notice.kind==="customer" && (invoice.status!=="paid" || orderResult.data.status!=="paid")) throw new Error("Invoice is not paid");
      const evidenceResult=notice.kind==="admin"?await db.from("ap_crypto_observations").select("evidence,state,created_at").eq("order_id",notice.order_id).order("created_at",{ascending:false}).limit(5):null;
      const sharedResult=notice.kind==="admin" && notice.event==="matching_review"?await db.from("ap_shared_crypto_deposits").select("network,txid,evidence,candidate_ids,matching_state").contains("candidate_ids",[notice.order_id]).order("updated_at",{ascending:false}).limit(10):null;
      const fullDetails=notice.kind==="admin"?`\n\nOrder details:\n${JSON.stringify(orderResult.data,null,2)}\nRecent evidence:\n${JSON.stringify(evidenceResult?.data||[],null,2)}\nShared deposit matches:\n${JSON.stringify(sharedResult?.data||[],null,2)}`:"";
      const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json","Idempotency-Key":notice.id},body:JSON.stringify({from,to,subject:`Avera Prive: ${notice.event.replace(/_/g," ")} - ${invoice.invoice_number}`,text:invoiceLines(invoice).join("\n")+fullDetails,attachments:notice.event==="confirmed"?[{filename:`${invoice.invoice_number}.pdf`,content:invoicePdf(invoice).toString("base64")}]:undefined}),signal:AbortSignal.timeout(15000)});
      if(!response.ok) throw new Error(`Email service returned ${response.status}`);
      const saved=await db.from("ap_payment_notifications").update({status:"sent",sent_at:new Date().toISOString(),locked_until:null,last_error:null}).eq("id",notice.id).eq("status","sending");
      if(saved.error) throw new Error("Email delivery receipt could not be stored");
      sent++;
    } catch {
      failed++;
      await db.from("ap_payment_notifications").update({status:"pending",locked_until:null,last_error:"Email delivery failed. Check sender, recipients and service configuration.",retry_after:new Date(Date.now()+Math.min(3600000,60000*2**Math.min(notice.attempts,6))).toISOString()}).eq("id",notice.id);
    }
  }
  return {sent,failed};
}
