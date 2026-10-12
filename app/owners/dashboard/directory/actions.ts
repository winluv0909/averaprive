"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaffRole } from "@/lib/auth/authorization";
import { createSlug } from "@/lib/agencies/slug";
import { readProfileSnapshot } from "@/lib/agencies/claim-profile";
export async function addAgency(form: FormData) {
  const { supabase } = await requireStaffRole(["super_admin"]);
  const { error } = await supabase.rpc("ap_add_curated_agency", {
    agency_name: String(form.get("name") ?? ""),
    agency_slug: createSlug(String(form.get("name") ?? "")),
    official_website: String(form.get("website") ?? ""),
    agency_country: String(form.get("country") ?? ""),
    agency_about: String(form.get("about") ?? ""),
  });
  revalidatePath("/owners/dashboard/directory");
  redirect(
    `/owners/dashboard/directory?${error ? `error=${encodeURIComponent(error.message)}` : "added=1"}`,
  );
}
export async function reviewClaim(
  id: string,
  decision: "approved" | "rejected",
  form: FormData,
) {
  const { supabase } = await requireStaffRole(["super_admin"]);
  const { error } = await supabase.rpc("ap_review_agency_claim_checked", {
    target_claim: id,
    decision,
    review_note: String(form.get("note") ?? ""),
    checks: Object.fromEntries(["identity", "authority", "contact", "information"].map((key) => [key, form.get(key) === "on"])),
    expected_profile: readProfileSnapshot(form.get("profile_snapshot")),
  });
  revalidatePath("/owners/dashboard/directory");
  redirect(
    `/owners/dashboard/directory?${error ? `error=${encodeURIComponent(error.message)}` : "reviewed=1"}`,
  );
}

export async function correctProfile(id: string, form: FormData) {
  const { supabase } = await requireStaffRole(["super_admin"]);
  const get = (name: string) => String(form.get(name) ?? "").trim();
  const { error } = await supabase.rpc("ap_correct_curated_profile", {
    target_agency: id,
    expected_profile: readProfileSnapshot(form.get("profile_snapshot")),
    changes: {
      name: get("name"), website_url: get("website"), about: get("about"), country: get("country"), city: get("city"),
      services: get("services").split("\n").map((x) => x.trim()).filter(Boolean),
      directory_information: Object.fromEntries(["legal_name", "registration_number", "registered_address", "public_email", "public_phone"].map((key) => [key, get(key) || null])),
    },
    source_url: get("source"), review_note: get("note"),
  });
  revalidatePath("/owners/dashboard/directory");
  redirect(`/owners/dashboard/directory?${error ? `error=${encodeURIComponent(error.message)}` : "corrected=1"}`);
}
