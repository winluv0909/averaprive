import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingSeller } from "@/lib/billing/config";
import { paypalConfig, paypalReturnBase } from "./config";
import { paypalRequest, PayPalApiError } from "./client";
import { approvalUrl, assertOrderMatches, verifiedCapture, type LocalPayPalOrder, type PayPalOrder, type PayPalCapture } from "./domain";
export async function localPayPalOrder(id: string, agencyId?: string) {
  let query = createAdminClient().from("ap_payment_orders").select("*").eq("id", id).eq("provider", "paypal");
  if (agencyId) query = query.eq("agency_id", agencyId);
  const { data, error } = await query.single();
  if (error || !data) throw new Error("PayPal payment was not found");
  return data as LocalPayPalOrder;
}
export async function preparePayPalCheckout(input: Record<string, string>) {
  const config = paypalConfig(), db = createAdminClient();
  const created = await db.rpc("ap_create_paypal_invoice", { input: { ...input, environment: config.environment }, seller: billingSeller });
  if (created.error || !created.data) throw new Error("Unable to create the PayPal invoice. Check the billing migration and information.");
  return resumePayPalCheckout(created.data, input.agency_id, input.created_by);
}
// The server action verifies current billing membership before calling this.
// Reuse the invoice and PayPal idempotency key; never create a second invoice.
export async function resumePayPalCheckout(id: string, agencyId: string, actorUserId: string) {
  const config = paypalConfig(), base = paypalReturnBase(), db = createAdminClient();
  let local = await localPayPalOrder(id, agencyId);
  if (local.paypal_environment !== config.environment) throw new Error("Payment belongs to another PayPal environment");
  if (!["created", "pending"].includes(local.status)) throw new Error("This payment cannot restart checkout");
  const expires = new Date(local.payment_expires_at).getTime();
  if (!Number.isFinite(expires) || expires <= Date.now()) throw new Error("This checkout expired. Contact billing support before starting another payment.");
  if (local.status === "created") {
    const prepared = await db.rpc("ap_prepare_paypal_checkout", {target_order: id, target_agency: agencyId, actor_user: actorUserId});
    if (prepared.error) throw new Error("Checkout state could not be prepared. Contact billing support.");
    local = await localPayPalOrder(id, agencyId);
    if (local.status !== "pending") throw new Error("Checkout state requires review");
  }
  if (local.provider_reference && local.checkout_url) return { id: local.id, url: local.checkout_url };
  const destination = `${base}/agency/dashboard/agencies/${local.agency_id}/billing/paypal/${local.id}`;
  const remote = await paypalRequest<PayPalOrder>("/v2/checkout/orders", "POST", {
    intent: "CAPTURE", purchase_units: [{ reference_id: local.id, custom_id: local.id, invoice_id: local.id,
      description: `Avera Prive ${local.plan_code} - ${local.billing_cycle} access (no auto-renewal)`,
      amount: { currency_code: local.currency, value: Number(local.total_amount).toFixed(2) } }],
    payment_source: { paypal: { experience_context: { brand_name: "Avera Prive", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW", return_url: destination, cancel_url: `${destination}?cancelled=1` } } },
  }, `c${local.id}`);
  if (!remote.id || !/^[A-Z0-9]+$/.test(remote.id)) throw new Error("Invalid PayPal order response");
  // Always obtain authoritative order details, including the account receiving funds.
  const details = await paypalRequest<PayPalOrder>(`/v2/checkout/orders/${remote.id}`);
  const merchantId = details.purchase_units?.[0]?.payee?.merchant_id;
  if (!merchantId || (config.merchantId && config.merchantId !== merchantId)) throw new Error("PayPal receiving account does not match configuration");
  assertOrderMatches({ ...local, provider_reference: remote.id, paypal_merchant_id: merchantId }, details);
  const url = approvalUrl(remote, config.environment);
  const saved = await db.rpc("ap_attach_paypal_order", { target_order: local.id, environment: config.environment, remote_id: remote.id, merchant_id: merchantId, approval_url: url });
  if (saved.error) throw new Error("PayPal order could not be linked. Retry this checkout; do not start another payment.");
  return { id: local.id, url };
}
export async function reconcilePayPalOrder(id: string, allowCapture = false, expectRefund = false) {
  const local = await localPayPalOrder(id), config = paypalConfig(), db = createAdminClient();
  if (local.paypal_environment !== config.environment) throw new Error("Payment belongs to another PayPal environment");
  if (config.merchantId && local.paypal_merchant_id !== config.merchantId) throw new Error("Payment receiving account mismatch");
  if (!local.provider_reference || ["refunded", "failed", "cancelled"].includes(local.status)) return local.paypal_state;
  let remote = await paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(local.provider_reference)}`);
  assertOrderMatches(local, remote);
  if (remote.status === "APPROVED" && allowCapture) {
    try {
      await paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(remote.id)}/capture`, "POST", {}, `p${local.id}`);
    } catch (error) {
      // A concurrent capture or a lost response can be recovered by reading the order.
      // Never mark a timeout or API error as successful.
      if (!(error instanceof PayPalApiError) && !(error instanceof Error)) throw error;
    }
    remote = await paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(local.provider_reference)}`);
    assertOrderMatches(local, remote);
  }
  const captures = remote.purchase_units![0].payments?.captures || [];
  if (captures.length > 1) throw new Error("Multiple captures require billing review");
  if (!captures.length) return remote.status === "APPROVED" ? "approved" : "awaiting_approval";
  const capture = await paypalRequest<PayPalCapture>(`/v2/payments/captures/${encodeURIComponent(captures[0].id)}`);
  if (capture.id !== captures[0].id || capture.supplementary_data?.related_ids?.order_id !== remote.id) throw new Error("Capture identity mismatch");
  if (expectRefund && !["REFUNDED", "PARTIALLY_REFUNDED"].includes(capture.status)) throw new Error("Refund status is not yet visible; retry event delivery");
  const states: Record<string, string> = { PENDING: "pending", DECLINED: "denied", DENIED: "denied", REFUNDED: "refunded", PARTIALLY_REFUNDED: "partially_refunded" };
  if (states[capture.status]) {
    const saved = await db.rpc("ap_paypal_exception", { target_order: id, new_state: states[capture.status], details: { capture_id: capture.id, status: capture.status } });
    if (saved.error) throw new Error("Payment status could not be recorded");
    return states[capture.status];
  }
  const proof = verifiedCapture(local, remote, capture);
  const recorded = await db.rpc("ap_record_paypal_capture", { target_order: id, proof });
  if (recorded.error) throw new Error("Payment could not be finalized. Contact billing support; do not pay again.");
  return recorded.data as string;
}
export async function reconcilePendingPayPal() {
  const config = paypalConfig(), db = createAdminClient();
  const query = await db.from("ap_payment_orders").select("id").eq("provider", "paypal").eq("paypal_environment", config.environment)
    .eq("status", "pending").not("provider_reference", "is", null).lte("monitor_after", new Date().toISOString()).order("monitor_after").limit(2);
  if (query.error) throw new Error("PayPal reconciliation queue unavailable");
  let verified = 0, failed = 0;
  for (const order of query.data || []) {
    try { await reconcilePayPalOrder(order.id, true); verified++; } catch {
      failed++;
      await db.rpc("ap_paypal_exception", { target_order: order.id, new_state: "verification_error", details: { message: "PayPal verification unavailable; retry or review receiving account." } });
    }
    const updated = await db.from("ap_payment_orders").update({ monitor_after: new Date(Date.now() + 120000).toISOString(), last_monitored_at: new Date().toISOString() }).eq("id", order.id);
    if (updated.error) failed++;
  }
  return { verified, failed };
}
