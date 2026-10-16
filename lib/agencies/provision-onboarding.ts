import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSlug } from "./slug";

type OnboardingProfile = {
  registrationReservationId?: string; registrationNumber?: string;
  agencyName?: string; country?: string; city?: string; websiteUrl?: string; logoUrl?: string;
  services?: string[]; creatorNiches?: string[]; regionsServed?: string[]; agencySize?: string;
  foundedYear?: number | null; languages?: string[]; positioning?: string; about?: string;
  instagram?: string; linkedin?: string;
  verification?: { legalCompanyName?: string; registrationNumber?: string; registrationCountry?: string; representative?: string; representativeTitle?: string; businessEmail?: string; notes?: string };
};

export async function provisionOnboardingAgency(supabase: SupabaseClient, user: User) {
  const profile = user.user_metadata?.onboarding_profile as OnboardingProfile | undefined;
  if (!profile?.agencyName || user.user_metadata?.onboarding_provisioned) return null;

  const base = createSlug(profile.agencyName) || "agency";
  const slug = `${base}-${user.id.slice(0, 6)}`;

  // Resume only this registration's agency, never an arbitrary team membership.
  const findAgency = () => supabase.from("ap_agencies")
    .select("id, publication_status").eq("slug", slug).maybeSingle();
  const { data: existing, error: lookupError } = await findAgency();
  if (lookupError) throw new Error(lookupError.message);
  let agency = existing;
  if (!agency) {
    const { data: createdId, error: createError } = await supabase.rpc("ap_create_agency_draft", {
      agency_name: profile.agencyName, agency_slug: slug,
    });
    if (createError || !createdId) {
      // Another request may have created the same deterministic draft.
      const { data: recovered, error: recoveryError } = await findAgency();
      if (recoveryError || !recovered) {
        throw new Error(recoveryError?.message ?? createError?.message ?? "Agency profile could not be created.");
      }
      agency = recovered;
    } else {
      agency = { id: createdId as string, publication_status: "draft" };
    }
  }
  const agencyId = agency.id;
  const { data: owner, error: ownerError } = await supabase.from("ap_agency_memberships")
    .select("agency_id").eq("agency_id", agencyId).eq("user_id", user.id)
    .eq("role", "owner").eq("status", "active").maybeSingle();
  if (ownerError) throw new Error(ownerError.message);
  if (!owner) throw new Error("Agency owner access is required to complete registration.");
  if (!["draft", "submitted", "approved", "published", "changes_requested"].includes(agency.publication_status)) {
    throw new Error("This agency registration cannot be resumed in its current state. Contact support for assistance.");
  }

  if (profile.registrationReservationId || profile.registrationNumber) {
    // Never trust editable metadata as proof of ownership or number validity.
    const { data: authenticated, error: authenticationError } = await supabase.auth.getUser();
    if (authenticationError || authenticated.user?.id !== user.id || !authenticated.user.email || !authenticated.user.email_confirmed_at) {
      throw new Error("Sign in again to complete your agency registration.");
    }
    const { error: numberError } = await createAdminClient().rpc("ap_bind_registration_number", {
      reservation_id: profile.registrationReservationId,
      supplied_number: profile.registrationNumber,
      target_user: authenticated.user.id,
      target_agency: agencyId,
      target_owner_email: authenticated.user.email,
    });
    if (numberError) throw new Error("Your registration number could not be assigned. Contact support to resume registration.");
  }

  // Submitted or approved profiles must not be overwritten by stale signup data.
  if (agency.publication_status === "draft") {
    const { error: updateError } = await supabase.from("ap_agencies").update({
      country: profile.country || null,
      city: profile.city || null,
      website_url: profile.websiteUrl || null,
      logo_url: profile.logoUrl || null,
      services: profile.services ?? [],
      creator_niches: profile.creatorNiches ?? [],
      regions_served: profile.regionsServed ?? [],
      employee_count_range: profile.agencySize || null,
      founded_year: profile.foundedYear || null,
      languages: profile.languages ?? [],
      positioning_statement: profile.positioning || null,
      about: profile.about || null,
      social_links: { instagram: profile.instagram || null, linkedin: profile.linkedin || null },
      updated_at: new Date().toISOString(),
    }).eq("id", agencyId).eq("publication_status", "draft").select("id").single();
    if (updateError) throw new Error(updateError.message);

    const { error: submitError } = await supabase.rpc("ap_submit_agency_for_review", { target_agency: agencyId });
    if (submitError) {
      const { data: current, error: currentError } = await findAgency();
      if (currentError || !current || !["submitted", "approved", "published", "changes_requested"].includes(current.publication_status)) {
        throw new Error(currentError?.message ?? submitError.message);
      }
    }
  }
  if (profile.verification?.registrationNumber) {
    const { data: previous, error: verificationLookupError } = await supabase.from("ap_verifications")
      .select("id").eq("agency_id", agencyId).eq("submitted_by", user.id).limit(1).maybeSingle();
    if (verificationLookupError) throw new Error(verificationLookupError.message);
    if (!previous) {
      const { error: verificationError } = await supabase.rpc("ap_submit_verification_request", {
        target_agency: agencyId,
        private_evidence: {
          legal_company_name: profile.verification.legalCompanyName,
          registration_number: profile.verification.registrationNumber,
          registration_country: profile.verification.registrationCountry,
          authorized_representative: profile.verification.representative,
          representative_title: profile.verification.representativeTitle,
          business_email: profile.verification.businessEmail,
          evidence_notes: profile.verification.notes,
        },
      });
      if (verificationError) throw new Error(verificationError.message);
    }
  }
  const { error: completionError } = await supabase.auth.updateUser({ data: { onboarding_provisioned: true, onboarding_agency_id: agencyId, onboarding_profile: null } });
  if (completionError) throw new Error(completionError.message);
  return agencyId as string;
}
