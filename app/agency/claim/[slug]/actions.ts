"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/authorization";
import { readProfileSnapshot } from "@/lib/agencies/claim-profile";

export async function requestClaim(slug: string, form: FormData) {
  const { supabase } = await requireUser();
  const { data: agency } = await supabase
    .from("ap_public_agencies")
    .select("id,demo_profile")
    .eq("slug", slug)
    .maybeSingle();
  if (!agency || agency.demo_profile) redirect("/agencies.html");
  const { error } = await supabase.rpc("ap_request_agency_claim_reviewed", {
    target_agency: agency.id,
    ownership_evidence: String(form.get("evidence") ?? ""),
    full_name: String(form.get("representative_name") ?? ""),
    job_role: String(form.get("representative_role") ?? ""),
    company_contact: String(form.get("business_contact") ?? ""),
    information_confirmed: form.get("profile_confirmed") === "on" && form.get("authorized") === "on",
    corrections: String(form.get("corrections") ?? ""),
    expected_profile: readProfileSnapshot(form.get("profile_snapshot")),
  });
  redirect(
    `/agency/claim/${slug}?${error ? `error=${encodeURIComponent(error.message)}` : "submitted=1"}`,
  );
}
export async function createClaimAccount(slug: string, form: FormData) {
  if (!/^[a-z0-9-]+$/.test(slug)) redirect("/agencies.html");
  const supabase = await createClient();
  const callback = new URL(
    "/auth/callback",
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  );
  callback.searchParams.set("next", `/agency/claim/${slug}`);
  const { data, error } = await supabase.auth.signUp({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
    options: { emailRedirectTo: callback.toString() },
  });
  if (error)
    redirect(
      `/agency/claim/${slug}?error=${encodeURIComponent(error.message)}`,
    );
  redirect(
    `/agency/claim/${slug}?${data.session ? "connected=1" : "confirm=1"}`,
  );
}
