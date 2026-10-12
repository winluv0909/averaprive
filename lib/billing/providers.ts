import { paypalPlanId, siteUrl } from "./config";

type CheckoutInput = {
  orderId: string;
  agencyId: string;
  agencyName: string;
  customerEmail: string;
  planCode: string;
  planName: string;
  cycle: "monthly" | "annual";
  amount: number;
  currency: string;
};

export async function createXenditCheckout(input: CheckoutInput) {
  const secret = process.env.XENDIT_SECRET_KEY;
  if (!secret) throw new Error("Xendit is not configured yet. Add XENDIT_SECRET_KEY to the server environment.");
  const base = siteUrl();
  if (!base.startsWith("https://")) throw new Error("Xendit checkout requires NEXT_PUBLIC_SITE_URL to be an HTTPS deployment URL.");
  const now = new Date();
  const anchor = new Date(now);
  anchor.setUTCDate(Math.min(anchor.getUTCDate(), 28));
  anchor.setUTCMonth(anchor.getUTCMonth() + (input.cycle === "annual" ? 12 : 1));

  const response = await fetch("https://api.xendit.co/sessions", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      reference_id: input.orderId,
      session_type: "SUBSCRIPTION",
      mode: "PAYMENT_LINK",
      amount: input.amount,
      currency: input.currency,
      country: "PH",
      customer: {
        reference_id: input.agencyId,
        type: "BUSINESS",
        email: input.customerEmail,
        business_detail: { business_name: input.agencyName },
      },
      locale: "en",
      description: `${input.planName} — ${input.cycle} Avera Privé plan`,
      subscription: {
        schedule: {
          interval: "MONTH",
          interval_count: input.cycle === "annual" ? 12 : 1,
          anchor_date: anchor.toISOString(),
          retry_interval: "DAY",
          retry_interval_count: 1,
          total_retry: 3,
          failed_attempt_notifications: [1, 2, 3],
        },
        failed_cycle_action: "RESUME",
      },
      notification_channels: ["EMAIL"],
      metadata: { agency_id: input.agencyId, plan_code: input.planCode, order_id: input.orderId },
      success_return_url: `${base}/agency/dashboard/agencies/${input.agencyId}/billing?checkout=return`,
      cancel_return_url: `${base}/agency/dashboard/agencies/${input.agencyId}/billing?checkout=cancelled`,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.payment_link_url) throw new Error(data.message || "Xendit could not create the checkout session.");
  return {
    checkoutUrl: String(data.payment_link_url),
    sessionId: String(data.payment_session_id),
    providerReference: String(data.reference_id || input.orderId),
  };
}

async function paypalAccessToken() {
  const client = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!client || !secret) throw new Error("PayPal is not configured yet. Add the PayPal server credentials.");
  const api = process.env.PAYPAL_API_BASE || "https://api-m.paypal.com";
  const response = await fetch(`${api}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${client}:${secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("PayPal authentication failed.");
  return { token: String(data.access_token), api };
}

export async function createPayPalCheckout(input: CheckoutInput) {
  const planId = paypalPlanId(input.planCode, input.cycle);
  if (!planId) throw new Error(`PayPal plan mapping is missing for ${input.planCode} ${input.cycle}.`);
  const { token, api } = await paypalAccessToken();
  const base = siteUrl();
  if (!base.startsWith("https://")) throw new Error("PayPal checkout requires NEXT_PUBLIC_SITE_URL to be an HTTPS deployment URL.");
  const response = await fetch(`${api}/v1/billing/subscriptions`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", prefer: "return=representation" },
    body: JSON.stringify({
      plan_id: planId,
      custom_id: input.orderId,
      subscriber: { email_address: input.customerEmail },
      application_context: {
        brand_name: "Avera Privé",
        user_action: "SUBSCRIBE_NOW",
        return_url: `${base}/agency/dashboard/agencies/${input.agencyId}/billing?checkout=return`,
        cancel_url: `${base}/agency/dashboard/agencies/${input.agencyId}/billing?checkout=cancelled`,
      },
    }),
  });
  const data = await response.json();
  const approval = data.links?.find((link: { rel?: string; href?: string }) => link.rel === "approve")?.href;
  if (!response.ok || !approval) throw new Error(data.message || "PayPal could not create the subscription.");
  return { checkoutUrl: String(approval), sessionId: String(data.id), providerReference: String(data.id) };
}
