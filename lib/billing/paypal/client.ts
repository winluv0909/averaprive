import "server-only";
import { paypalConfig } from "./config";
export class PayPalApiError extends Error {
  constructor(public status: number) { super("PayPal could not complete this request. Please retry or contact billing support."); }
}
export async function paypalRequest<T>(path: string, method = "GET", body?: unknown, requestId?: string): Promise<T> {
  const config = paypalConfig();
  // Fresh token per operation avoids mixing credentials/environments in warm workers.
  const auth = await fetch(`${config.base}/v1/oauth2/token`, { method: "POST", cache: "no-store",
    headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials", signal: AbortSignal.timeout(10000) });
  if (!auth.ok) throw new PayPalApiError(auth.status);
  const token = await auth.json();
  if (!token.access_token) throw new PayPalApiError(503);
  const response = await fetch(`${config.base}${path}`, { method, cache: "no-store", redirect: "error",
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json", Prefer: "return=representation", ...(requestId ? { "PayPal-Request-Id": requestId } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new PayPalApiError(response.status);
  return response.json() as Promise<T>;
}
export async function verifyPayPalWebhook(headers: Headers, event: unknown) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error("PayPal webhook is not configured");
  const fields = ["paypal-auth-algo", "paypal-cert-url", "paypal-transmission-id", "paypal-transmission-sig", "paypal-transmission-time"];
  if (fields.some(field => !headers.get(field))) return false;
  const verification = await paypalRequest<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", "POST", {
    auth_algo: headers.get(fields[0]), cert_url: headers.get(fields[1]), transmission_id: headers.get(fields[2]),
    transmission_sig: headers.get(fields[3]), transmission_time: headers.get(fields[4]), webhook_id: webhookId, webhook_event: event,
  });
  return verification.verification_status === "SUCCESS";
}
