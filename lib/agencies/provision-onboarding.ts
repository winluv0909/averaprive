import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSlug } from "./slug";

type OnboardingProfile = {
  agencyName?: string; country?: string; city?: string; websiteUrl?: string; logoUrl?: string;
  services?: string[]; creatorNiches?: string[]; regionsServed?: string[]; agencySize?: string;
  foundedYear?: number | null; languages?: string[]; positioning?: string; about?: string;
  instagram?: string; linkedin?: string;
  verification?: { legalCompanyName?: string; registrationNumber?: string; registrationCountry?: string; representative?: string; representativeTitle?: string; businessEmail?: string; notes?: string };
};

export async function provisionOnboardingAgency(supabase: SupabaseClient, user: User) {
  const profile = user.user_metadata?.onboarding_profile as OnboardingProfile | undefined;
  if (!profile?.agencyName || user.user_metadata?.onboarding_provisioned) return null;

  const { data: existing } = await supabase.from("ap_agency_memberships").select("agency_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (existing?.agency_id) return existing.agency_id as string;

  const base = createSlug(profile.agencyName) || "agency";
  const slug = `${base}-${user.id.slice(0, 6)}`;
  const { data: agencyId, error: createError } = await supabase.rpc("ap_create_agency_draft", { agency_name: profile.agencyName, agency_slug: slug });
  if (createError || !agencyId) throw new Error(createError?.message ?? "Agency profile could not be created.");

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
  }).eq("id", agencyId);
  if (updateError) throw new Error(updateError.message);

  const { error: submitError } = await supabase.rpc("ap_submit_agency_for_review", { target_agency: agencyId });
  if (submitError) throw new Error(submitError.message);
  if (profile.verification?.registrationNumber) {
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
  await supabase.auth.updateUser({ data: { onboarding_provisioned: true, onboarding_agency_id: agencyId, onboarding_profile: null } });
  return agencyId as string;
}
