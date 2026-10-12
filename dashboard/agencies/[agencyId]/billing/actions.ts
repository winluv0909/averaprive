"use server";

import { redirect } from "next/navigation";
import { requireAgencyRole } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingSeller } from "@/lib/billing/config";
import {
  createNowPaymentsPayment,
  toNowPaymentsCurrency,
} from "@/lib/billing/nowpayments";

const validPlans = new Set([
  "prive",
  "select",
  "elite",
]);

const validCycles = new Set([
  "monthly",
  "annual",
]);

const validProviders = new Set([
  "crypto",
]);

function fail(
  agencyId: string,
  message: string,
): never {
  redirect(
    `/agency/dashboard/agencies/${agencyId}/billing?error=${encodeURIComponent(
      message,
    )}`,
  );
}

export async function startTrial(
  agencyId: string,
) {
  const { supabase } = await requireAgencyRole(
    agencyId,
    ["owner", "admin", "billing"],
  );

  const { error } = await supabase.rpc(
    "ap_start_prive_trial",
    {
      target_agency: agencyId,
    },
  );

  if (error) {
    fail(agencyId, error.message);
  }

  redirect(
    `/agency/dashboard/agencies/${agencyId}/billing?trial=1`,
  );
}

export async function createCheckout(
  agencyId: string,
  formData: FormData,
) {
  const { supabase, user } =
    await requireAgencyRole(agencyId, [
      "owner",
      "admin",
      "billing",
    ]);

  const planCode = String(
    formData.get("plan") || "",
  ).toLowerCase();

  const cycle = String(
    formData.get("cycle") || "monthly",
  ).toLowerCase();

  const provider = String(
    formData.get("provider") || "",
  ).toLowerCase();

  const legalName = String(
    formData.get("legal_name") || "",
  ).trim();

  const billingEmail = String(
    formData.get("billing_email") || "",
  )
    .trim()
    .toLowerCase();

  const billingAddress = String(
    formData.get("billing_address") || "",
  ).trim();

  const taxId = String(
    formData.get("tax_id") || "",
  ).trim();

  const cryptoAsset = String(
    formData.get("crypto_asset") || "",
  ).toUpperCase();

  const cryptoNetwork = String(
    formData.get("crypto_network") || "",
  ).toUpperCase();

  const userMetadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";

  const payerFullName = String(
    formData.get("full_name") ||
      userMetadataName ||
      legalName,
  ).trim();

  const payerCompanyName = String(
    formData.get("company_name") ||
      legalName,
  ).trim();

  if (
    !validPlans.has(planCode) ||
    !validCycles.has(cycle) ||
    !validProviders.has(provider)
  ) {
    fail(
      agencyId,
      "Invalid checkout selection.",
    );
  }

  if (
    payerFullName.length < 2 ||
    legalName.length < 2 ||
    payerCompanyName.length < 2 ||
    billingAddress.length < 8 ||
    !billingEmail.includes("@")
  ) {
    fail(
      agencyId,
      "Complete the customer and billing information.",
    );
  }

  const payCurrency = toNowPaymentsCurrency(
    cryptoAsset,
    cryptoNetwork,
  );

  if (!payCurrency) {
    fail(
      agencyId,
      "The selected cryptocurrency and network are not currently supported for automatic crypto billing.",
    );
  }

  const [
    { data: agency },
    { data: plan },
  ] = await Promise.all([
    supabase
      .from("ap_agencies")
      .select("id,name,country")
      .eq("id", agencyId)
      .maybeSingle(),

    supabase
      .from("ap_plans")
      .select(
        "code,name,monthly_price_usd,annual_price_usd",
      )
      .eq("code", planCode)
      .eq("active", true)
      .maybeSingle(),
  ]);

  if (!agency || !plan) {
    fail(
      agencyId,
      "Agency or plan was not found.",
    );
  }

  const monthlyPrice = Number(
    plan.monthly_price_usd,
  );

  const annualPrice = Number(
    plan.annual_price_usd,
  );

  const amount =
    cycle === "annual"
      ? annualPrice
      : monthlyPrice;

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    fail(
      agencyId,
      "The selected plan does not have a valid price.",
    );
  }

  const currency = "USD";
  const admin = createAdminClient();

  const { error: profileError } =
    await admin
      .from("ap_billing_profiles")
      .upsert(
        {
          agency_id: agencyId,
          contact_full_name: payerFullName,
          legal_name: legalName,
          billing_email: billingEmail,
          billing_address: billingAddress,
          tax_id: taxId || null,
          country_code: String(
            agency.country || "PH",
          )
            .slice(0, 2)
            .toUpperCase(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "agency_id",
        },
      );

  if (profileError) {
    fail(agencyId, profileError.message);
  }

  const {
    data: order,
    error: orderError,
  } = await admin
    .from("ap_payment_orders")
    .insert({
      agency_id: agencyId,
      plan_code: planCode,
      billing_cycle: cycle,
      provider: "crypto",
      currency,
      subtotal: amount,
      tax_amount: 0,
      total_amount: amount,
      status: "pending",
      created_by: user.id,

      payer_full_name: payerFullName,
      payer_email: billingEmail,
      payer_company_name: payerCompanyName,
      payer_billing_address: billingAddress,

      crypto_asset: cryptoAsset,
      crypto_network: cryptoNetwork,
      receiving_address: "pending",
      expected_crypto_amount: 0,
      required_confirmations: 1,
      blockchain_confirmations: 0,
      current_crypto_status: "awaiting_payment",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    fail(
      agencyId,
      orderError?.message ||
        "Unable to create payment order.",
    );
  }

  const nowPayment = await createNowPaymentsPayment({
    orderId: order.id,
    amountUsd: amount,
    payCurrency,
    description: `${plan.name} — ${cycle} Avera Privé plan`,
  }).catch(async (error: unknown) => {
    await admin
      .from("ap_payment_orders")
      .update({
        status: "failed",
        failure_reason:
          error instanceof Error
            ? error.message
            : "NOWPayments payment creation failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    fail(
      agencyId,
      error instanceof Error
        ? error.message
        : "Unable to create the crypto payment.",
    );
  });

  const dueAt = nowPayment.expiresAt
    ? new Date(nowPayment.expiresAt)
    : new Date(Date.now() + 10 * 60 * 1000);

  const {
    data: invoice,
    error: invoiceError,
  } = await admin
    .from("ap_invoices")
    .insert({
      order_id: order.id,
      agency_id: agencyId,
      status: "open",
      currency,
      subtotal: amount,
      tax_amount: 0,
      total_amount: amount,
      due_at: dueAt.toISOString(),

      seller_snapshot: billingSeller,

      customer_snapshot: {
        full_name: payerFullName,
        legal_name: legalName,
        company_name: payerCompanyName,
        billing_email: billingEmail,
        billing_address: billingAddress,
        tax_id: taxId || null,
      },

      line_items: [
        {
          description:
            `${plan.name} — ${cycle} plan`,
          quantity: 1,
          unit_price: amount,
          amount,
        },
      ],

      payment_snapshot: {
        asset: cryptoAsset,
        display_symbol: cryptoAsset,
        network: cryptoNetwork,
        receiving_address: nowPayment.payAddress,
        expected_crypto_amount: nowPayment.payAmount,
        usd_total: amount,
        quoted_at: nowPayment.createdAt,
        expires_at: dueAt.toISOString(),
        status: nowPayment.status,
        provider: "nowpayments",
        provider_payment_id: nowPayment.paymentId,
        pay_currency: nowPayment.payCurrency,
        reference: order.id,
      },

      notes:
        "Payment purchases commercial tools and labelled visibility only. It never purchases verification, rankings, reviews, or moderation outcomes.",
    })
    .select("id,invoice_number")
    .single();

  if (invoiceError || !invoice) {
    await admin
      .from("ap_payment_orders")
      .update({
        status: "failed",
        failure_reason:
          invoiceError?.message ||
          "Invoice creation failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    fail(
      agencyId,
      invoiceError?.message ||
        "Unable to create invoice.",
    );
  }

  const cryptoPaymentUrl =
    `/agency/dashboard/agencies/${agencyId}` +
    `/billing/payments/${order.id}`;

  const { error: orderUpdateError } =
    await admin
      .from("ap_payment_orders")
      .update({
        provider_reference:
          invoice.invoice_number,
        checkout_url: cryptoPaymentUrl,
        nowpayments_payment_id: nowPayment.paymentId,
        nowpayments_status: nowPayment.status,
        pay_currency: nowPayment.payCurrency,
        pay_amount: nowPayment.payAmount,
        pay_address: nowPayment.payAddress,
        receiving_address: nowPayment.payAddress,
        expected_crypto_amount: nowPayment.payAmount,
        payment_expires_at: dueAt.toISOString(),
        current_crypto_status: "awaiting_payment",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

  if (orderUpdateError) {
    fail(
      agencyId,
      orderUpdateError.message,
    );
  }

  redirect(cryptoPaymentUrl);
}