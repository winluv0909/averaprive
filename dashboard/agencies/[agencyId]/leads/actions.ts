"use server";
import { redirect } from "next/navigation";
import { requireAgencyRole } from "@/lib/auth/authorization";
export async function updateLead(agencyId:string,inquiryId:string,formData:FormData){const {supabase}=await requireAgencyRole(agencyId,["owner","admin"]);const {error}=await supabase.rpc("ap_agency_update_lead",{target_agency:agencyId,target_inquiry:inquiryId,next_status:String(formData.get("status")||"delivered"),outcome_note:String(formData.get("note")||"")});if(error)redirect(`/agency/dashboard/agencies/${agencyId}/leads?error=${encodeURIComponent(error.message)}`);redirect(`/agency/dashboard/agencies/${agencyId}/leads?updated=1`)}
