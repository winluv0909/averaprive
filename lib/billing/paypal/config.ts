import "server-only";
export type PayPalEnvironment = "sandbox" | "live";
export function paypalConfig() {
  const environment = process.env.PAYPAL_ENV || "sandbox";
  if (environment !== "sandbox" && environment !== "live") throw new Error("Invalid PayPal environment");
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error("PayPal credentials are missing");
  if (environment === "live" && (process.env.PAYPAL_LIVE_ENABLED !== "true" || !process.env.PAYPAL_MERCHANT_ID || !process.env.PAYPAL_WEBHOOK_ID || (process.env.PAYPAL_MONITOR_SECRET || "").length < 32)) {
    throw new Error("Live PayPal payments are not enabled");
  }
  return { environment: environment as PayPalEnvironment, clientId, secret,
    merchantId: process.env.PAYPAL_MERCHANT_ID || null,
    base: environment === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com" };
}
export function paypalReady() { try { paypalConfig(); return true; } catch { return false; } }
export function paypalReturnBase() {
  const url = new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
  if (url.username || url.password || !["https:", "http:"].includes(url.protocol)) throw new Error("Invalid site URL");
  if (paypalConfig().environment === "live" && url.protocol !== "https:") throw new Error("Live checkout requires HTTPS");
  return url.origin;
}
