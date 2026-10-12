export const billingSeller = {
  name: process.env.BILLING_SELLER_NAME || "Avera Privé",
  address: process.env.BILLING_SELLER_ADDRESS || "Philippines",
  email: process.env.BILLING_SUPPORT_EMAIL || "billing@agencyprive.com",
  taxId: process.env.BILLING_SELLER_TAX_ID || "",
};

export function siteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!value) return "http://localhost:3000";
  return value.startsWith("http") ? value.replace(/\/$/, "") : `https://${value.replace(/\/$/, "")}`;
}

export function paypalPlanId(planCode: string, cycle: string) {
  const key = `PAYPAL_PLAN_${planCode}_${cycle}`.toUpperCase();
  return process.env[key];
}
