import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data } = await supabase.from("ap_editorial_posts").select("slug,updated_at").eq("status", "published");
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
    ...(data ?? []).map((post) => ({ url: `${base}/insights/${post.slug}`, lastModified: new Date(post.updated_at), changeFrequency: "monthly" as const, priority: .8 })),
  ];
}
