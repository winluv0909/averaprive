import { requireAgencyRole } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
export async function GET(_request:Request,{params}:{params:Promise<{agencyId:string;orderId:string}>}) {
  const {agencyId,orderId}=await params;
  await requireAgencyRole(agencyId,["owner","admin","billing"]);
  const {data,error}=await createAdminClient().from("ap_payment_orders").select("current_crypto_status,blockchain_confirmations,last_monitored_at,status").eq("id",orderId).eq("agency_id",agencyId).single();
  if(error) return Response.json({error:"Payment not found"},{status:404});
  return Response.json(data,{headers:{"Cache-Control":"no-store"}});
}
