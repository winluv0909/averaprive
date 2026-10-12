"use server";
import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/authorization";
export async function decidePlanRequest(requestId:string,decision:string,formData:FormData){const {supabase}=await requireStaffRole(["super_admin","finance"]);const {error}=await supabase.rpc("ap_decide_plan_request",{request_id:requestId,decision,decision_note:String(formData.get("note")||""),commercial_ref:String(formData.get("commercial_reference")||"")});if(error)redirect(`/owners/dashboard/subscriptions?error=${encodeURIComponent(error.message)}`);redirect("/owners/dashboard/subscriptions?updated=1")}
