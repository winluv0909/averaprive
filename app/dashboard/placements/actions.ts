"use server";
import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/authorization";
const text=(formData:FormData,key:string)=>String(formData.get(key)??"").trim();

export async function createPlacement(formData:FormData){const {supabase}=await requireStaffRole(["super_admin","finance"]);const {error}=await supabase.rpc("ap_create_sponsored_placement",{target_agency:text(formData,"agency_id"),placement_kind:text(formData,"placement_type"),inventory_key:text(formData,"placement_key"),start_time:text(formData,"starts_at"),end_time:text(formData,"ends_at"),payment_reference:text(formData,"commercial_reference"),staff_notes:text(formData,"internal_notes")});if(error)redirect(`/owners/dashboard/placements?error=${encodeURIComponent(error.message)}`);redirect("/owners/dashboard/placements?created=1")}
export async function updatePlacementStatus(id:string,status:"scheduled"|"active"|"paused"|"expired"|"cancelled",formData:FormData){const {supabase}=await requireStaffRole(["super_admin","finance"]);const {error}=await supabase.rpc("ap_update_sponsored_placement_status",{placement_id:id,next_status:status,decision_note:text(formData,"reason")});if(error)redirect(`/owners/dashboard/placements/${id}?error=${encodeURIComponent(error.message)}`);redirect(`/owners/dashboard/placements/${id}?updated=${status}`)}
