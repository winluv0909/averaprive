import { walletOptions } from "@/lib/billing/wallet/config";
import { randomUUID } from "node:crypto";
import { paypalReady } from "@/lib/billing/paypal/config";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAgencyRole } from "@/lib/auth/authorization";
import { AgencyWorkspaceShell } from "../../../../_components/portal-shells";
import { createCheckout } from "../actions";
import PlanSelection from "./PlanSelection";
import { PaymentMethodSelector } from "./PaymentMethodSelector";


export default async function BillingCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencyId: string }>;
  searchParams: Promise<{ plan?: string }>;
}) {
  const { agencyId } = await params;
  const { plan: requestedPlan = "" } = await searchParams;

  if (!["prive", "select", "elite"].includes(requestedPlan)) {
    redirect(`/agency/dashboard/agencies/${agencyId}/billing`);
  }

  const { supabase, user } = await requireAgencyRole(agencyId, [
    "owner",
    "admin",
    "billing",
  ]);

  const [{ data: agency }, { data: plan }, { data: profile }, { data: plans }] =
    await Promise.all([
      supabase
        .from("ap_agencies")
        .select("name,country,city")
        .eq("id", agencyId)
        .maybeSingle(),

      supabase
        .from("ap_plans")
        .select(
  "code,name,monthly_price_usd,annual_price_usd,description",
)
        .eq("code", requestedPlan)
        .maybeSingle(),

      createAdminClient()
        .from("ap_billing_profiles")
        .select("*")
        .eq("agency_id", agencyId)
        .maybeSingle(),
      supabase.from("ap_plans").select("code,name,monthly_price_usd,annual_price_usd").eq("active",true).in("code",["prive","select","elite"]),
    ]);

  if (!agency || !plan || !plans?.length) {
    notFound();
  }

  const monthlyPrice = Number(plan.monthly_price_usd);
  const formattedPrice = monthlyPrice.toFixed(2);
  const formattedMonthlyPrice =
    monthlyPrice.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <AgencyWorkspaceShell email={user.email}>
      <main className="checkout-main checkout-main--premium checkout-reference">
        <header className="premium-checkout-bar">
          <Link
            className="premium-checkout-brand"
            href={`/agency/dashboard/agencies/${agencyId}/billing`}
          >
            Avera Privé
          </Link>

          <span className="premium-checkout-secure">
            <span aria-hidden="true">▣</span>
            Secure payment
          </span>
        </header>

        <form
          className="premium-checkout"
          action={createCheckout.bind(null, agencyId)}
        >
          <input type="hidden" name="checkout_request_id" value={randomUUID()} />
          <aside className="premium-checkout-summary">
            <div className="premium-plan-visual">
              <div>
                <p>SELECTED PLAN</p>

                <h1 data-checkout-plan-name>{plan.name}</h1>

                <span>
                  Agency visibility and growth tools
                </span>

                <strong data-checkout-amount>
                  ${formattedMonthlyPrice} USD
                </strong>

                <small data-checkout-billing-label>
                  Billed monthly
                </small>
              </div>
            </div>

            <div className="premium-order-summary">
              <h2>Order summary</h2>

<div className="premium-order-line">
  <span>Selected plan</span>
  <b data-checkout-plan-name>{plan.name}</b>
</div>

<div className="premium-order-line">
  <span>Total</span>
  <b data-checkout-standard-price>
    ${formattedPrice}
  </b>
</div>

<div className="premium-order-line">
  <span>Discount</span>
  <b data-checkout-discount>
    $0.00
  </b>
</div>

<div className="premium-order-line">
  <span>Discounted subtotal</span>
  <b data-checkout-subtotal>
    ${formattedPrice}
  </b>
</div>

<div className="premium-order-total">
  <span>Total amount to be paid today</span>
  <strong data-checkout-amount>
    ${formattedPrice} USD
  </strong>
</div>

              <ul className="premium-plan-benefits">
                <li>
                  <span aria-hidden="true">↗</span>

                  <div>
                    <b>Grow your agency</b>

                    <small>
                      Get discovered by premium clients
                    </small>
                  </div>
                </li>

                <li>
                  <span aria-hidden="true">◇</span>

                  <div>
                    <b>Unlock more opportunities</b>

                    <small>
                      Tools designed for agency success
                    </small>
                  </div>
                </li>

                <li>
                  <span aria-hidden="true">✓</span>

                  <div>
                    <b>No automatic renewal</b>

                    <small>
                      Purchase the next period from your billing dashboard
                    </small>
                  </div>
                </li>
              </ul>
            </div>
          </aside>

          <section className="premium-checkout-payment">
            <p className="premium-checkout-kicker">
              SECURE CHECKOUT
            </p>

            <h2>1. Company & billing information</h2>

            <div className="premium-checkout-fields">
              <label>
                Legal business name

                <input
                  name="legal_name"
                  required
                  minLength={2}
                  defaultValue={
                    profile?.legal_name || agency.name
                  }
                />
              </label>

              <label>
                Billing email

                <input
                  name="billing_email"
                  type="email"
                  required
                  defaultValue={
                    profile?.billing_email || user.email || ""
                  }
                />
              </label>

              <label className="wide">
                Billing address

                <textarea
                  name="billing_address"
                  required
                  minLength={8}
                  defaultValue={
                    profile?.billing_address ||
                    [agency.city, agency.country]
                      .filter(Boolean)
                      .join(", ")
                  }
                />
              </label>

              <label>
                Tax ID / registration number{" "}
                <small>Optional</small>

                <input
                  name="tax_id"
                  defaultValue={profile?.tax_id || ""}
                />
              </label>
            </div>

            <PlanSelection plans={plans.map(p=>({...p,monthly_price_usd:Number(p.monthly_price_usd),annual_price_usd:p.annual_price_usd===null?null:Number(p.annual_price_usd)}))} initial={plan.code} />
            <h3>4. Payment method</h3>
            <PaymentMethodSelector ready={paypalReady()} environment={process.env.PAYPAL_ENV || "sandbox"} channels={walletOptions()} />
            <div className="premium-payment-footnote"><span aria-hidden="true">▣</span>
              <p>Payment is confirmed by our server before live plan access is activated. PayPal approval or a submitted crypto transaction hash alone is not proof of payment.</p>
            </div>

            <p className="premium-commercial-note">
              Payment purchases commercial tools only. It does not
              grant verification, alter objective rankings, purchase
              reviews, or override moderation.
            </p>
          </section>
        </form>
      </main>
    </AgencyWorkspaceShell>
  );
}