import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortObject((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
  }
  return value;
}

function validSignature(payload: unknown, signature: string, secret: string) {
  const digest = createHmac("sha512", secret)
    .update(JSON.stringify(sortObject(payload)))
    .digest("hex");
  const left = Buffer.from(digest, "utf8");
  const right = Buffer.from(signature || "", "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

const SUCCESS_STATUSES = new Set(["finished", "confirmed"]);
const CONFIRMING_STATUSES = new Set(["confirming", "sending"]);
const FAILURE_STATUSES = new Set(["failed", "expired", "refunded", "partially_paid"]);

export async function POST(
  request: Request,
  context: { params: Promise<{ secret: string }> },
) {
  const { secret } = await context.params;
  const expected = process.env.NOWPAYMENTS_IPN_SECRET?.trim();

  if (!expected || secret !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const signature = request.headers.get("x-nowpayments-sig") || "";

  if (!validSignature(payload, signature, expected)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const paymentId = String(payload.payment_id || "");
  const orderId = String(payload.order_id || "");
  const status = String(payload.payment_status || "").toLowerCase();

  if (!paymentId || !orderId || !status) {
    return Response.json({ error: "Invalid IPN payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  const eventId = `nowpayments:${paymentId}:${status}:${String(payload.updated_at || payload.created_at || "")}`;

  const { error: eventError } = await admin.from("ap_payment_events").insert({
    provider: "nowpayments",
    provider_event_id: eventId,
    event_type: `payment_${status}`,
    order_id: orderId,
    payload,
    processed: false,
  });

  if (eventError?.code === "23505") {
    return Response.json({ ok: true, duplicate: true });
  }

  if (eventError) {
    return Response.json({ error: eventError.message }, { status: 500 });
  }

  const update: Record<string, unknown> = {
    nowpayments_status: status,
    updated_at: new Date().toISOString(),
  };

  if (payload.pay_address) update.pay_address = String(payload.pay_address);
  if (payload.pay_amount) update.pay_amount = String(payload.pay_amount);
  if (payload.pay_currency) update.pay_currency = String(payload.pay_currency).toUpperCase();

  if (SUCCESS_STATUSES.has(status)) {
    const txid = payload.payin_hash || payload.tx_hash || payload.transaction_hash;
    const confirmations = Number(payload.confirmations || 0);
    const { error } = await admin.rpc("ap_activate_crypto_payment", {
      target_order: orderId,
      verified_txid: txid ? String(txid) : null,
      confirmations: Number.isFinite(confirmations) ? confirmations : 0,
    });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  } else if (CONFIRMING_STATUSES.has(status)) {
    update.status = "pending";
    update.current_crypto_status = "confirming";
    update.transaction_detected_at = new Date().toISOString();
    const txid = payload.payin_hash || payload.tx_hash || payload.transaction_hash;
    if (txid) update.transaction_hash = String(txid);
    await admin.from("ap_payment_orders").update(update).eq("id", orderId).eq("nowpayments_payment_id", paymentId);
  } else if (FAILURE_STATUSES.has(status)) {
    update.status = status === "expired" ? "cancelled" : "failed";
    update.current_crypto_status = status;
    await admin.from("ap_payment_orders").update(update).eq("id", orderId).eq("nowpayments_payment_id", paymentId);
  } else {
    update.current_crypto_status = status;
    await admin.from("ap_payment_orders").update(update).eq("id", orderId).eq("nowpayments_payment_id", paymentId);
  }

  await admin.from("ap_payment_events").update({
    processed: true,
    processed_at: new Date().toISOString(),
  }).eq("provider_event_id", eventId);

  return Response.json({ ok: true });
}
