import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
export const publicProfileFields = "id,name,slug,tagline,positioning_statement,about,country,city,logo_url,services,published_at,demo_profile";
export const getPublicProfile = cache(async (slug: string) => {
  if (!/^[a-z0-9_-]{1,80}$/i.test(slug)) return null;
  // This view is the existing publication boundary used by the directory API.
  const {data, error} = await createAdminClient().from("ap_public_agencies")
    .select(publicProfileFields).eq("slug", slug).eq("demo_profile", false).maybeSingle();
  if (error) throw new Error("Public agency profile is temporarily unavailable.");
  return data;
});
export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));
}
export function profileDescription(agency: {about?: unknown; tagline?: unknown; positioning_statement?: unknown; name: unknown}) {
  return String(agency.tagline || agency.positioning_statement || agency.about || `Explore ${agency.name} on Avera Privé.`).replace(/\s+/g," ").trim().slice(0,160);
}
