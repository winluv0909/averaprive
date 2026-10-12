"use server";

import { redirect } from "next/navigation";
import { requireAgencyRole } from "@/lib/auth/authorization";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function submitVerificationRequest(agencyId: string, formData: FormData) {
  const { supabase } = await requireAgencyRole(agencyId, ["owner", "admin"]);
  const evidence = {
    company_legal_name: text(formData, "company_legal_name"),
    registration_number: text(formData, "registration_number"),
    registration_country: text(formData, "registration_country"),
    official_website: text(formData, "official_website"),
    representative_name: text(formData, "representative_name"),
    representative_title: text(formData, "representative_title"),
    business_email: text(formData, "business_email"),
    evidence_notes: text(formData, "evidence_notes"),
  };

  if (!evidence.company_legal_name || !evidence.registration_country || !evidence.representative_name || !evidence.business_email) {
    redirect(`/agency/dashboard/agencies/${agencyId}/verification?error=${encodeURIComponent("Complete all required verification fields.")}`);
  }

  const { error } = await supabase.rpc("ap_submit_verification_request", {
    target_agency: agencyId,
    private_evidence: evidence,
  });
  if (error) redirect(`/agency/dashboard/agencies/${agencyId}/verification?error=${encodeURIComponent(error.message)}`);
  redirect(`/agency/dashboard/agencies/${agencyId}/verification?submitted=1`);
}
