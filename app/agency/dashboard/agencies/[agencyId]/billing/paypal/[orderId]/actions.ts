"use server";
import { redirect } from "next/navigation";
import { requireAgencyRole } from "@/lib/auth/authorization";
import { localPayPalOrder, reconcilePayPalOrder } from "@/lib/billing/paypal/service";
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
