import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_384) return NextResponse.json({ error: "Inquiry is too large." }, { status: 413 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || body.website) return NextResponse.json({ error: "Invalid inquiry." }, { status: 400 });
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const message = String(body.message ?? "").trim();
  if (name.length < 2 || name.length > 100 || message.length < 20 || message.length > 3000 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "Check the inquiry details and try again." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ap_submit_inquiry", {
    target_agency: String(body.agencyId ?? ""),
    visitor_session: String(body.sessionId ?? ""),
    contact_name: name,
    contact_email: email,
    inquiry_message: message,
    event_source: String(body.source || "organic"),
    contact_consent: body.consent === true,
  });
  if (error) return NextResponse.json({ error: "Inquiry could not be sent. Please verify the details or wait before trying again." }, { status: 400 });
  return NextResponse.json({ id: data, status: "received" }, { status: 201 });
}
