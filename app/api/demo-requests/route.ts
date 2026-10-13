import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const reply = (body: object, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store" },
});
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return reply({ error: "Submit your request from the Avera Privé website." }, 403);
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return reply({ error: "Invalid request format." }, 415);
  }
  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 12000) return reply({ error: "Request is too large." }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    input = parsed as Record<string, unknown>;
  } catch {
    return reply({ error: "Invalid request. Please try again." }, 400);
  }
  const text = (key: string) => typeof input[key] === "string" ? input[key].trim() : "";
  const details = {
    firstName: text("firstName"), lastName: text("lastName"),
    email: text("email").toLowerCase(), agencyName: text("agencyName"),
    agencySize: text("agencySize"), plan: text("plan"),
    website: text("website"), goals: text("goals"), consent: input.consent === true,
  };
  const requestId = text("requestId");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
    || !details.firstName || details.firstName.length > 80
    || !details.lastName || details.lastName.length > 80
    || !emailPattern.test(details.email) || details.email.length > 254
    || details.agencyName.length < 2 || details.agencyName.length > 160
    || !["solo", "2-10", "11-50", "51-100", "100-plus"].includes(details.agencySize)
    || !["free", "prive", "select", "elite", "not-sure"].includes(details.plan)
    || details.goals.length < 20 || details.goals.length > 800
    || details.website.length > 2048 || !details.consent || text("companyFax")) {
    return reply({ error: "Please check your details and contact consent." }, 400);
  }
  if (details.website) {
    try {
      const url = new URL(details.website);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
    } catch {
      return reply({ error: "Enter a valid website URL beginning with https:// or http://." }, 400);
    }
  }
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return reply({ error: "Demo requests are temporarily unavailable. Please try again later." }, 503);
  // Vercel supplies this header; do not trust arbitrary forwarded headers for rate limits.
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() || "unknown";
  const visitorHash = createHmac("sha256", secret).update(ip).digest("hex");
  try {
    const admin = createAdminClient();
    const { data: savedId, error } = await admin.rpc("ap_record_demo_request", {
      request_id: requestId, visitor_hash: visitorHash, request_details: details,
    });
    if (error || !savedId) {
      if (error?.message.includes("DEMO_RATE_LIMIT")) {
        return reply({ error: "Too many requests. Please wait an hour before trying again." }, 429);
      }
      return reply({ error: "Your request could not be saved. Please try again later." }, 503);
    }
    const { data: saved, error: readError } = await admin.from("ap_demo_requests")
      .select("notification_status,created_at").eq("id", savedId).single();
    if (readError || !saved) {
      // The database receipt is already committed; do not tell the visitor it was lost.
      return reply({ requestId: savedId, message: "Your demo request has been saved. Our team will review it." });
    }
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.DEMO_EMAIL_FROM || process.env.PAYMENT_EMAIL_FROM;
    const recipients = (process.env.DEMO_ADMIN_EMAILS || process.env.PAYMENT_ADMIN_EMAILS || "")
      .split(",").map(value => value.trim()).filter(value => emailPattern.test(value));
    // The owner inbox remains the durable source of requests if email is unavailable.
    if (saved.notification_status !== "sent" && apiKey && from && recipients.length
      && Date.now() - Date.parse(saved.created_at) < 23 * 60 * 60 * 1000) {
      let notificationStatus = "failed";
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json",
            "Idempotency-Key": `demo-request/${savedId}` },
          body: JSON.stringify({ from, to: recipients, reply_to: details.email,
            subject: "Avera Privé — New demo request",
            text: [
              `Request: ${savedId}`, `Name: ${details.firstName} ${details.lastName}`,
              `Email: ${details.email}`, `Agency: ${details.agencyName}`,
              `Team size: ${details.agencySize}`, `Plan: ${details.plan}`,
              `Website: ${details.website || "Not supplied"}`, "", details.goals,
              "", "Contact consent: granted", "", "Review requests in the owner portal at /owners/dashboard/demo-requests.",
            ].join("\n") }),
          signal: AbortSignal.timeout(10000),
        });
        if (response.ok) notificationStatus = "sent";
      } catch { /* Keep the saved request available in the owner inbox. */ }
      await admin.from("ap_demo_requests").update({ notification_status: notificationStatus }).eq("id", savedId).neq("notification_status", "sent");
    }
    return reply({ requestId: savedId, message: "Your demo request has been saved. Our team will review it. This does not book an appointment or create a subscription." });
  } catch {
    return reply({ error: "Demo requests are temporarily unavailable. Please try again later." }, 503);
  }
}
