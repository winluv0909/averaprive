"use server";
import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/authorization";
export async function updateInquiry(inquiryId: string, formData: FormData) {
  const { supabase } = await requireStaffRole(["super_admin", "support"]);
  const { error } = await supabase.rpc("ap_update_inquiry", { target_inquiry: inquiryId, next_status: String(formData.get("status") || "new"), next_qualification: String(formData.get("qualification") || "unreviewed"), review_note: String(formData.get("note") || "") });
  if (error) redirect(`/owners/dashboard/inquiries?error=${encodeURIComponent(error.message)}`);
  redirect("/owners/dashboard/inquiries?updated=1");
}
