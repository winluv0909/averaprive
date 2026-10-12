"use server";
import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/authorization";

const text=(formData:FormData,key:string)=>String(formData.get(key)??"").trim();

export async function resolveFraudInvestigation(id:string,decision:"investigating"|"cleared"|"confirmed"|"closed",formData:FormData){
  const {supabase}=await requireStaffRole(["super_admin","moderator","verification_reviewer"]);
  const {error}=await supabase.rpc("ap_resolve_fraud_investigation",{investigation_id:id,decision,decision_reason:text(formData,"reason")});
  if(error) redirect(`/owners/dashboard/fraud/${id}?error=${encodeURIComponent(error.message)}`);
  redirect(`/owners/dashboard/fraud/${id}?reviewed=${decision}`);
}

export async function flagReviewForFraud(reviewId:string,formData:FormData){
  const {supabase}=await requireStaffRole(["super_admin","moderator"]);
  const {data:review}=await supabase.from("ap_reviews").select("agency_id,reviewer_id").eq("id",reviewId).maybeSingle();
  if(!review) redirect(`/owners/dashboard/reviews/${reviewId}?error=${encodeURIComponent("Review not found.")}`);
  const severity=text(formData,"severity")||"medium"; const summary=text(formData,"summary");
  const {error}=await supabase.rpc("ap_create_fraud_investigation",{target_agency:review.agency_id,investigated_user:review.reviewer_id,investigated_type:"review",investigated_id:reviewId,risk_severity:severity,risk_signal:"manual_reviewer_flag",risk_summary:summary,risk_signals:{source:"review_moderation"}});
  if(error) redirect(`/owners/dashboard/reviews/${reviewId}?error=${encodeURIComponent(error.message)}`);
  redirect(`/owners/dashboard/reviews/${reviewId}?flagged=1`);
}
