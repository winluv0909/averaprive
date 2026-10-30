import { NextResponse } from "next/server";
import { boundedJson, RequestBodyError, requestHasSameOrigin } from "@/lib/http/bounded-json";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) {
    return NextResponse.json({ error: "Submit your inquiry from the Avera Privé website." }, {status: 403});
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return NextResponse.json({error: "Invalid request format."}, {status: 415});
  }
  let parsed: unknown;
  try { parsed = await boundedJson(request, 12_000); }
  catch (error) {
    return NextResponse.json({error: error instanceof RequestBodyError ? error.message : "Invalid inquiry."},
      {status: error instanceof RequestBodyError ? error.status : 400});
  }
  const body = parsed as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body) || body.website) return NextResponse.json({ error: "Invalid inquiry." }, { status: 400 });
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (email.length > 254 || body.consent !== true || name.length < 2 || name.length > 100 || message.length < 20 || message.length > 3000 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
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
