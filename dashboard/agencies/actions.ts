"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAgencyRole, requireUser } from "@/lib/auth/authorization";
import { createSlug } from "@/lib/agencies/slug";

export async function createAgencyDraft(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slug = createSlug(String(formData.get("slug") || name));
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("ap_create_agency_draft", { agency_name: name, agency_slug: slug });
  if (error) redirect(`/agency/dashboard/agencies/new?error=${encodeURIComponent(error.message)}`);
  redirect(`/agency/dashboard/agencies/${data}`);
}

export async function saveAgencyProfile(agencyId: string, formData: FormData) {
  const { supabase } = await requireAgencyRole(agencyId, ["owner","admin","editor"]);
  const list = (key: string) => String(formData.get(key) ?? "").split(",").map(v => v.trim()).filter(Boolean);
  const { error } = await supabase.from("ap_agencies").update({
    name: String(formData.get("name") ?? "").trim(),
    positioning_statement: String(formData.get("positioning_statement") ?? "").trim() || null,
    country: String(formData.get("country") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim() || null,
    website_url: String(formData.get("website_url") ?? "").trim() || null,
    about: String(formData.get("about") ?? "").trim() || null,
    services: list("services"), creator_niches: list("creator_niches"), regions_served: list("regions_served"),
    updated_at: new Date().toISOString(),
  }).eq("id", agencyId);
  if (error) redirect(`/agency/dashboard/agencies/${agencyId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/agency/dashboard/agencies/${agencyId}`);
  redirect(`/agency/dashboard/agencies/${agencyId}?saved=1`);
}

export async function submitAgencyProfile(agencyId: string) {
  const { supabase } = await requireAgencyRole(agencyId, ["owner","admin"]);
  const { error } = await supabase.rpc("ap_submit_agency_for_review", { target_agency: agencyId });
  if (error) redirect(`/agency/dashboard/agencies/${agencyId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/agency/dashboard/agencies/${agencyId}`);
  redirect(`/agency/dashboard/agencies/${agencyId}?submitted=1`);
}
