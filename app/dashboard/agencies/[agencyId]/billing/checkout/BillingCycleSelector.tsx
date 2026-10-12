"use client";

import { useEffect, useMemo, useState } from "react";

type BillingCycle = "monthly" | "annual";

type BillingCycleSelectorProps = {
  monthlyPrice: number;
  annualPrice: number;
};

function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function BillingCycleSelector({
  monthlyPrice,
  annualPrice,
}: BillingCycleSelectorProps) {
  const [billingCycle, setBillingCycle] =
    useState<BillingCycle>("monthly");

  const standardAnnualPrice = monthlyPrice * 12;

  const annualSavings = useMemo(
    () => Math.max(standardAnnualPrice - annualPrice, 0),
    [standardAnnualPrice, annualPrice],
  );

  const discountPercentage = useMemo(() => {
    if (standardAnnualPrice <= 0 || annualSavings <= 0) {
      return 0;
    }

    return Math.round(
      (annualSavings / standardAnnualPrice) * 100,
    );
  }, [standardAnnualPrice, annualSavings]);

  useEffect(() => {
    const isAnnual = billingCycle === "annual";

    const standardPrice = isAnnual
      ? standardAnnualPrice
      : monthlyPrice;

    const discount = isAnnual ? annualSavings : 0;

    const discountedSubtotal = isAnnual
      ? annualPrice
      : monthlyPrice;

    document
      .querySelectorAll<HTMLElement>(
        "[data-checkout-standard-price]",
      )
      .forEach((element) => {
        element.textContent = formatUsd(standardPrice);
      });

    document
      .querySelectorAll<HTMLElement>(
        "[data-checkout-discount]",
      )
      .forEach((element) => {
        element.textContent =
          discount > 0
            ? `−${formatUsd(discount)}`
            : formatUsd(0);
      });

    document
      .querySelectorAll<HTMLElement>(
        "[data-checkout-subtotal]",
      )
      .forEach((element) => {
        element.textContent =
          formatUsd(discountedSubtotal);
      });

    document
      .querySelectorAll<HTMLElement>(
        "[data-checkout-amount]",
      )
      .forEach((element) => {
        element.textContent =
          formatUsd(discountedSubtotal);
      });

    document
      .querySelectorAll<HTMLElement>(
        "[data-checkout-billing-label]",
      )
      .forEach((element) => {
        element.textContent = isAnnual
          ? discount > 0
            ? `Billed annually · Save ${formatUsd(
                discount,
              )}`
            : "Billed annually"
          : "Billed monthly";
      });

    document
      .querySelectorAll<HTMLElement>(
        "[data-checkout-subscription-label]",
      )
      .forEach((element) => {
        element.textContent = isAnnual
          ? "Annual subscription"
          : "Monthly subscription";
      });
  }, [
    billingCycle,
    monthlyPrice,
    annualPrice,
    standardAnnualPrice,
    annualSavings,
  ]);

  return (
    <div className="billing-cycle-selector">
      <label htmlFor="billing-cycle">
        3. Billing cycle
      </label>

      <select
        id="billing-cycle"
        name="billingCycle"
        value={billingCycle}
        onChange={(event) =>
          setBillingCycle(
            event.target.value as BillingCycle,
          )
        }
      >
        <option value="monthly">
          Monthly — {formatUsd(monthlyPrice)} USD
        </option>

        <option value="annual" disabled={!Number.isFinite(annualPrice) || annualPrice <= 0}>
          Annual — {annualPrice > 0 ? `${formatUsd(annualPrice)} USD` : "Not configured"}
          {discountPercentage > 0
            ? ` · Save ${discountPercentage}%`
            : ""}
        </option>
      </select>

      {billingCycle === "annual" &&
        annualSavings > 0 && (
          <p className="billing-cycle-savings">
            Annual billing saves you{" "}
            {formatUsd(annualSavings)}.
          </p>
        )}
    </div>
  );
}