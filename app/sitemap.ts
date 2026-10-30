import { createAdminClient } from "@/lib/supabase/admin";
import type { MetadataRoute } from "next";
import { siteOrigin, previewDeployment } from "@/lib/seo/settings";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (previewDeployment()) return [];
  const base = siteOrigin();
  const supabase = await createClient();
  const { data } = await supabase.from("ap_editorial_posts").select("slug,updated_at").eq("status", "published");
  const {data: agencies, error: agencyError} = await createAdminClient().from("ap_public_agencies")
    .select("slug,published_at").eq("demo_profile", false);
  if (agencyError) throw new Error("Unable to generate complete agency sitemap.");
  const core = [
    "/",
    "/agencies.html",
    "/compare.html",
    "/for-agencies.html",
    "/pricing.html",
    "/insights.html",
    "/rankings.html",
    "/reviews.html",
    "/trust.html",
    "/about.html",
    "/demo.html",
    "/legal.html",
  ];
  return [
    ...core.map((path, index) => ({ url: `${base}${path}`, changeFrequency: (index === 1 ? "daily" : "weekly") as "daily"|"weekly", priority: index === 0 ? 1 : path.includes("agencies") ? .9 : .7 })),
    ...(agencies ?? []).filter(agency => /^[a-z0-9_-]{1,80}$/i.test(agency.slug || "")).map(agency => ({url:`${base}/agencies/${encodeURIComponent(agency.slug)}`, ...(agency.published_at ? {lastModified:new Date(agency.published_at)} : {}), changeFrequency:"weekly" as const, priority:.8})),
    ...(data ?? []).map((post) => ({ url: `${base}/insights/${post.slug}`, lastModified: new Date(post.updated_at), changeFrequency: "monthly" as const, priority: .8 })),
  ];
}
