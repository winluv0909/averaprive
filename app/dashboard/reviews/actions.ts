"use server";

import { redirect } from "next/navigation";
import { requireAgencyRole, requireStaffRole, requireUser } from "@/lib/auth/authorization";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function submitReview(formData: FormData) {
  const { supabase } = await requireUser();
  const agencyId = value(formData, "agency_id");
  const rating = Number(value(formData, "rating"));
  const body = value(formData, "body");
  const evidence = {
    relationship: value(formData, "relationship"),
    evidence_notes: value(formData, "evidence_notes"),
  };
  if (!agencyId || !Number.isInteger(rating) || rating < 1 || rating > 5 || body.length < 50) {
    redirect(`/agency/dashboard/reviews/new?agencyId=${encodeURIComponent(agencyId)}&error=${encodeURIComponent("Provide an agency, a 1–5 rating, and at least 50 review characters.")}`);
  }
  const { error } = await supabase.rpc("ap_submit_review", {
    target_agency: agencyId, review_rating: rating, review_body: body, private_evidence: evidence,
  });
  if (error) redirect(`/agency/dashboard/reviews/new?agencyId=${encodeURIComponent(agencyId)}&error=${encodeURIComponent(error.message)}`);
  redirect("/agency/dashboard/reviews/new?submitted=1");
}

export async function moderateReview(reviewId: string, decision: "publish" | "reject" | "hide", formData: FormData) {
  const { supabase } = await requireStaffRole(["super_admin", "moderator"]);
  const reason = value(formData, "reviewer_reason");
  const relationshipVerified = formData.get("relationship_verified") === "on";
  const { error } = await supabase.rpc("ap_moderate_review", {
    target_review: reviewId, decision, reviewer_reason: reason, relationship_verified: relationshipVerified,
  });
  if (error) redirect(`/owners/dashboard/reviews/${reviewId}?error=${encodeURIComponent(error.message)}`);
  redirect(`/owners/dashboard/reviews/${reviewId}?reviewed=${decision}`);
}

export async function submitAgencyResponse(agencyId: string, reviewId: string, formData: FormData) {
  const { supabase } = await requireAgencyRole(agencyId, ["owner", "admin"]);
  const { error } = await supabase.rpc("ap_submit_agency_response", {
    target_review: reviewId, response_text: value(formData, "response_text"),
  });
  if (error) redirect(`/agency/dashboard/agencies/${agencyId}/reviews?error=${encodeURIComponent(error.message)}`);
  redirect(`/agency/dashboard/agencies/${agencyId}/reviews?responded=1`);
}

export async function submitReviewReport(agencyId: string, reviewId: string, formData: FormData) {
  const { supabase } = await requireAgencyRole(agencyId, ["owner", "admin"]);
  const { error } = await supabase.rpc("ap_submit_report", {
    target_agency: agencyId, target_review: reviewId, report_category: "review",
    report_reason: value(formData, "report_reason"),
    private_evidence: { evidence_notes: value(formData, "evidence_notes") },
  });
  if (error) redirect(`/agency/dashboard/agencies/${agencyId}/reviews?error=${encodeURIComponent(error.message)}`);
  redirect(`/agency/dashboard/agencies/${agencyId}/reviews?reported=1`);
}

export async function openReviewDispute(agencyId: string, reviewId: string, formData: FormData) {
  const { supabase } = await requireAgencyRole(agencyId, ["owner", "admin"]);
  const { error } = await supabase.rpc("ap_open_dispute", {
    target_review: reviewId, dispute_reason: value(formData, "dispute_reason"),
    private_evidence: { evidence_notes: value(formData, "evidence_notes") },
  });
  if (error) redirect(`/agency/dashboard/agencies/${agencyId}/reviews?error=${encodeURIComponent(error.message)}`);
  redirect(`/agency/dashboard/agencies/${agencyId}/reviews?disputed=1`);
}
