"use server";

import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/authorization";

export async function reviewVerification(verificationId: string, decision: "approve" | "needs_information" | "reject", formData: FormData) {
  const { supabase } = await requireStaffRole(["super_admin", "verification_reviewer"]);
  const reason = String(formData.get("reviewer_reason") ?? "").trim();
  const completedChecks = decision === "approve" ? {
    company_identity: "checked",
    website_control: "checked",
    representative_authority: "checked",
    business_presence: "checked",
  } : {};
  const { error } = await supabase.rpc("ap_review_verification_request", {
    verification_id: verificationId,
    decision,
    reviewer_reason: reason,
    completed_checks: completedChecks,
  });
  if (error) redirect(`/owners/dashboard/verifications/${verificationId}?error=${encodeURIComponent(error.message)}`);
  redirect(`/owners/dashboard/verifications/${verificationId}?reviewed=${decision}`);
}
