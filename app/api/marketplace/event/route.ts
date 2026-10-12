import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_384) return NextResponse.json({ error: "Invalid event." }, { status: 413 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  if (!["directory_impression", "profile_view", "contact_open", "website_click"].includes(String(body.eventType ?? ""))) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("ap_record_marketplace_event", {
    target_agency: String(body.agencyId ?? ""),
    event_name: String(body.eventType),
    visitor_session: String(body.sessionId ?? ""),
    event_page: String(body.page || "/").slice(0, 200),
    event_source: String(body.source || "organic"),
    analytics_consent: body.analyticsConsent === true,
  });
  if (error) return NextResponse.json({ error: "Event was not recorded." }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
