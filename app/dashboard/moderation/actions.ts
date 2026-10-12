"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/authorization";

export async function reviewAgencySubmission(agencyId: string, decision: "approve" | "request_changes" | "reject", formData: FormData) {
  const note = String(formData.get("reviewer_note") ?? "").trim();
  const { supabase } = await requireStaffRole(["super_admin", "moderator"]);
  const { error } = await supabase.rpc("ap_review_agency_submission", {
    target_agency: agencyId,
    decision,
    reviewer_note: note,
  });
  if (error) redirect(`/owners/dashboard/moderation/${agencyId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/owners/dashboard/moderation");
  revalidatePath(`/owners/dashboard/moderation/${agencyId}`);
  revalidatePath(`/agency/dashboard/agencies/${agencyId}`);
  redirect(`/owners/dashboard/moderation/${agencyId}?reviewed=${decision}`);
}

export async function publishAgency(agencyId: string) {
  const { supabase } = await requireStaffRole(["super_admin", "moderator"]);
  const { error } = await supabase.rpc("ap_publish_agency", { target_agency: agencyId });
  if (error) redirect(`/owners/dashboard/moderation/${agencyId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/owners/dashboard/moderation");
  revalidatePath(`/owners/dashboard/moderation/${agencyId}`);
  revalidatePath(`/agency/dashboard/agencies/${agencyId}`);
  redirect(`/owners/dashboard/moderation/${agencyId}?published=1`);
}
