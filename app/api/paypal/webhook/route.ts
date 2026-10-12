import { verifyPayPalWebhook, paypalRequest } from "@/lib/billing/paypal/client";
import type { PayPalCapture } from "@/lib/billing/paypal/domain";
import { paypalConfig } from "@/lib/billing/paypal/config";
import { reconcilePayPalOrder } from "@/lib/billing/paypal/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverNotifications } from "@/lib/billing/reliable/notifications";
export const runtime = "nodejs";
export const maxDuration = 300;
interface Event { id: string; event_type: string; resource?: { id?: string; supplementary_data?: { related_ids?: { order_id?: string; capture_id?: string } }; links?: Array<{ rel: string; href: string }> } }
export async function POST(request: Request) {
  let event: Event;
  try {
    const raw = await request.text();
    if (raw.length > 262144) return Response.json({ error: "Payload too large" }, { status: 413 });
    event = JSON.parse(raw);
    if (!event.id || !event.event_type) throw new Error("Invalid event");
    if (!(await verifyPayPalWebhook(request.headers, event))) return Response.json({ error: "Invalid signature" }, { status: 400 });
  } catch { return Response.json({ error: "Webhook verification unavailable or invalid" }, { status: 503 }); }
  const supported = ["CHECKOUT.ORDER.APPROVED", "PAYMENT.CAPTURE.COMPLETED", "PAYMENT.CAPTURE.PENDING", "PAYMENT.CAPTURE.DENIED", "PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"];
  if (!supported.includes(event.event_type)) return Response.json({ received: true });
  try {
    const db = createAdminClient(), environment = paypalConfig().environment;
    let remoteId = event.event_type === "CHECKOUT.ORDER.APPROVED" ? event.resource?.id : event.resource?.supplementary_data?.related_ids?.order_id;
    let captureId = event.resource?.supplementary_data?.related_ids?.capture_id;
    if (!captureId && event.event_type.startsWith("PAYMENT.CAPTURE.") && event.event_type !== "PAYMENT.CAPTURE.REFUNDED") captureId = event.resource?.id;
    if (!captureId && event.event_type === "PAYMENT.CAPTURE.REFUNDED") {
      // Extract only the capture ID; never fetch a URL provided in a webhook.
      const up = event.resource?.links?.find(link => link.rel === "up")?.href;
      if (up) captureId = /\/v2\/payments\/captures\/([A-Z0-9]+)(?:\?|$)/.exec(up)?.[1];
    }
    if (!remoteId && captureId && /^[A-Z0-9]+$/.test(captureId)) {
      const capture = await paypalRequest<PayPalCapture>(`/v2/payments/captures/${captureId}`);
      if (capture.id !== captureId) throw new Error("Capture mismatch");
      remoteId = capture.supplementary_data?.related_ids?.order_id;
    }
    let query = db.from("ap_payment_orders").select("id,paypal_capture_id").eq("provider", "paypal").eq("paypal_environment", environment);
    if (remoteId) query = query.eq("provider_reference", remoteId);
    else if (captureId) query = query.eq("paypal_capture_id", captureId);
    else throw new Error("Event cannot be linked yet");
    const found = await query.maybeSingle();
    if (found.error) throw new Error("Payment lookup failed");
    if (!found.data) throw new Error("Event arrived before the payment link was saved; retry delivery");
    if (event.event_type === "PAYMENT.CAPTURE.REVERSED") {
      // A verified reversal is terminal, including when the capture endpoint has not caught up.
      if (!captureId || (found.data.paypal_capture_id && found.data.paypal_capture_id !== captureId)) throw new Error("Capture binding unavailable; retry delivery");
      const saved = await db.rpc("ap_paypal_exception", { target_order: found.data.id, new_state: "reversed", details: { event_id: event.id, capture_id: captureId } });
      if (saved.error) throw new Error("Reversal could not be saved");
    } else {
      await reconcilePayPalOrder(found.data.id, event.event_type === "CHECKOUT.ORDER.APPROVED", event.event_type === "PAYMENT.CAPTURE.REFUNDED");
    }
    try { await deliverNotifications(); } catch { /* Queued emails retry independently. */ }
    return Response.json({ received: true });
  } catch { return Response.json({ error: "Payment event could not be processed; retry delivery" }, { status: 503 }); }
}
