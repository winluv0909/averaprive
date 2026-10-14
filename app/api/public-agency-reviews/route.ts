import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store" },
});

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug") || "";
  if (!/^[a-z0-9_-]{1,80}$/i.test(slug)) return reply({ error: "Invalid agency profile." }, 400);
  try {
    const publicClient = createAdminClient();
    const { data: agency, error: agencyError } = await publicClient.from("ap_public_agencies")
      .select("id,demo_profile").eq("slug", slug).maybeSingle();
    if (agencyError) return reply({ error: "Reviews are temporarily unavailable." }, 503);
    if (!agency || agency.demo_profile === true) return reply({ error: "Published agency not found." }, 404);

    // This server-only client reads an explicit public-field allowlist.
    // Never return the raw database row or select private evidence.
    const admin = createAdminClient();
    const { data: reviews, count, error: reviewError } = await admin.from("ap_reviews")
      .select("id,rating,body,published_at", { count: "exact" })
      .eq("agency_id", agency.id).eq("status", "published").eq("relationship_checked", true)
      .order("published_at", { ascending: false }).order("id").limit(100);
    if (reviewError) return reply({ error: "Reviews are temporarily unavailable." }, 503);
    const rows = reviews ?? [];
    const responses = new Map<string, string>();
    if (rows.length) {
      const { data: replies, error: responseError } = await admin.from("ap_review_responses")
        .select("review_id,response_body").eq("agency_id", agency.id)
        .eq("status", "published").in("review_id", rows.map(row => row.id))
        .order("published_at", { ascending: false }).limit(1000);
      if (responseError) return reply({ error: "Reviews are temporarily unavailable." }, 503);
      for (const response of replies ?? []) {
        if (!responses.has(response.review_id)) responses.set(response.review_id, response.response_body);
      }
    }
    return reply({
      totalReviews: count ?? rows.length,
      reviews: rows.map(row => ({
        id: row.id, rating: row.rating, text: row.body, status: "published",
        publishedAt: row.published_at,
        ...(responses.has(row.id) ? {
          responseStatus: "published", agencyResponse: responses.get(row.id),
        } : {}),
      })),
    });
  } catch {
    return reply({ error: "Reviews are temporarily unavailable." }, 503);
  }
}
