import { timingSafeEqual } from "node:crypto";
import { reconcilePendingPayPal } from "@/lib/billing/paypal/service";
import { deliverNotifications } from "@/lib/billing/reliable/notifications";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  const expected = process.env.PAYPAL_MONITOR_SECRET, supplied = request.headers.get("authorization") || "";
  if (!expected || expected.length < 32) return Response.json({ error: "Monitor is not configured" }, { status: 503 });
  const a = Buffer.from(supplied), b = Buffer.from(`Bearer ${expected}`);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const payments = await reconcilePendingPayPal(), email = await deliverNotifications();
    return Response.json({ payments, email }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "PayPal monitor unavailable; payments remain unconfirmed" }, { status: 503 }); }
}
export const GET = POST;
