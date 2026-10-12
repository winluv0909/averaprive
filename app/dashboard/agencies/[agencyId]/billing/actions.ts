"use server";
import { redirect } from "next/navigation";
import { requireAgencyRole } from "@/lib/auth/authorization";
import { prepareWalletCheckout, WalletCheckoutError } from "@/lib/billing/wallet/service";
import { preparePayPalCheckout } from "@/lib/billing/paypal/service";
function fail(agencyId: string, message: string): never {
  redirect(`/agency/dashboard/agencies/${agencyId}/billing?error=${encodeURIComponent(message)}`);
}
export async function startTrial(agencyId: string) {
  const { supabase } = await requireAgencyRole(agencyId, ["owner", "admin", "billing"]);
  const { error } = await supabase.rpc("ap_start_prive_trial", { target_agency: agencyId });
  if (error) fail(agencyId, error.message);
  redirect(`/agency/dashboard/agencies/${agencyId}/billing?trial=1`);
}
export async function createCheckout(agencyId: string, formData: FormData) {
  const { user } = await requireAgencyRole(agencyId, ["owner", "admin", "billing"]);
  const field = (key: string) => String(formData.get(key) || "").trim();
  const requestId = field("checkout_request_id"), plan = field("plan"), cycle = field("billingCycle");
  const legalName = field("legal_name"), email = field("billing_email").toLowerCase(), address = field("billing_address");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) ||
    !["prive", "select", "elite"].includes(plan) || !["monthly", "annual"].includes(cycle) || !["paypal", "crypto"].includes(field("provider"))) fail(agencyId, "Invalid checkout selection. Reload and try again.");
  if (legalName.length < 2 || legalName.length > 200 || address.length < 8 || address.length > 1000 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || field("tax_id").length > 100) fail(agencyId, "Complete your company name, billing email and address.");
  if (field("provider") === "crypto") {
    const channel = field("crypto_channel");
    const split = channel.indexOf("_");
    let id: string;
    try {
      const result = await prepareWalletCheckout({request_id: requestId, agency_id: agencyId, created_by: user.id, plan_code: plan, billing_cycle: cycle,
        legal_name: legalName, billing_email: email, billing_address: address, tax_id: field("tax_id"), full_name: String(user.user_metadata?.full_name || legalName).slice(0, 200),
        crypto_asset: channel.slice(0, split), crypto_network: channel.slice(split + 1)});
      id = result.id;
    } catch (error) {
      const safe = error instanceof WalletCheckoutError ? error : new WalletCheckoutError("WC_UNKNOWN", "Checkout could not be completed");
      console.error("Crypto checkout diagnostic", {reference: safe.reference, reason: safe.reason});
      fail(agencyId, `Crypto invoice unavailable. ${safe.reason}. Reference: ${safe.reference}`);
    }
    redirect(`/agency/dashboard/agencies/${agencyId}/billing/payments/${id}`);
  }
  let result: { id: string; url: string | null };
  try {
    result = await preparePayPalCheckout({ request_id: requestId, agency_id: agencyId, created_by: user.id, plan_code: plan,
      billing_cycle: cycle, legal_name: legalName, billing_email: email, billing_address: address, tax_id: field("tax_id"),
      full_name: String(user.user_metadata?.full_name || legalName).slice(0, 200) });
  } catch {
    fail(agencyId, "Unable to start PayPal checkout. Check your Sandbox credentials and apply the PayPal migration, or contact billing support.");
  }
  redirect(result.url || `/agency/dashboard/agencies/${agencyId}/billing/paypal/${result.id}`);
}
