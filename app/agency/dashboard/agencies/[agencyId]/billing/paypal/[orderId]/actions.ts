"use server";
import { redirect } from "next/navigation";
import { requireAgencyRole } from "@/lib/auth/authorization";
import { localPayPalOrder, reconcilePayPalOrder, resumePayPalCheckout } from "@/lib/billing/paypal/service";
import { deliverNotifications } from "@/lib/billing/reliable/notifications";
export async function confirmPayPalPayment(agencyId: string, orderId: string) {
  await requireAgencyRole(agencyId, ["owner", "admin", "billing"]);
  const url = `/agency/dashboard/agencies/${agencyId}/billing/paypal/${orderId}`;
  let failed = false;
  try {
    await localPayPalOrder(orderId, agencyId);
    await reconcilePayPalOrder(orderId, true);
  } catch { failed = true; }
  if (!failed) { try { await deliverNotifications(); } catch { /* Durable email queue retries via scheduled monitor. */ } }
  redirect(url + (failed ? "?error=Payment%20could%20not%20be%20verified.%20Retry%20verification%20or%20contact%20support.%20Do%20not%20pay%20again." : "?checked=1"));
}

export async function resumePayPalPayment(agencyId: string, orderId: string) {
  const { user } = await requireAgencyRole(agencyId, ["owner", "admin", "billing"]);
  const url = `/agency/dashboard/agencies/${agencyId}/billing/paypal/${orderId}`;
  let approval: string | null = null;
  try { approval = (await resumePayPalCheckout(orderId, agencyId, user.id)).url; }
  catch { redirect(url + "?error=PayPal%20checkout%20could%20not%20be%20started.%20Check%20the%20payment%20environment%2C%20credentials%2C%20expiry%20and%20checkout%20migration.%20Contact%20support%20before%20creating%20another%20invoice."); }
  redirect(approval || url);
}
