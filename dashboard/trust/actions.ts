"use server";

import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/authorization";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function moderateResponse(responseId: string, decision: "publish"|"reject"|"hide", formData: FormData) {
  const { supabase } = await requireStaffRole(["super_admin","moderator"]);
  const { error } = await supabase.rpc("ap_moderate_review_response", { target_response: responseId, decision, reviewer_reason: text(formData,"reason") });
  if (error) redirect(`/owners/dashboard/trust/responses/${responseId}?error=${encodeURIComponent(error.message)}`);
  redirect(`/owners/dashboard/trust/responses/${responseId}?reviewed=${decision}`);
}

export async function decideReport(reportId: string, decision: "action_taken"|"dismissed", formData: FormData) {
  const { supabase } = await requireStaffRole(["super_admin","moderator","support"]);
  const { error } = await supabase.rpc("ap_decide_report", { target_report: reportId, decision, decision_reason: text(formData,"reason") });
  if (error) redirect(`/owners/dashboard/trust/reports/${reportId}?error=${encodeURIComponent(error.message)}`);
  redirect(`/owners/dashboard/trust/reports/${reportId}?reviewed=${decision}`);
}

export async function resolveDispute(disputeId: string, decision: "upheld"|"denied", formData: FormData) {
  const { supabase } = await requireStaffRole(["super_admin","moderator","support"]);
  const { error } = await supabase.rpc("ap_resolve_dispute", { target_dispute: disputeId, decision, decision_reason: text(formData,"reason") });
  if (error) redirect(`/owners/dashboard/trust/disputes/${disputeId}?error=${encodeURIComponent(error.message)}`);
  redirect(`/owners/dashboard/trust/disputes/${disputeId}?reviewed=${decision}`);
}
