import "server-only";

import { siteUrl } from "./config";

const API_BASE = "https://api.nowpayments.io";

type CreatePaymentInput = {
  orderId: string;
  amountUsd: number;
  payCurrency: string;
  description: string;
};

type NowPaymentsResponse = {
  payment_id?: string | number;
  payment_status?: string;
  pay_address?: string;
  pay_amount?: number | string;
  pay_currency?: string;
  price_amount?: number | string;
  price_currency?: string;
  order_id?: string;
  expiration_estimate_date?: string;
  created_at?: string;
  updated_at?: string;
  payin_hash?: string;
  tx_hash?: string;
  transaction_hash?: string;
  confirmations?: number | string;
};

function apiKey() {
  const key = process.env.NOWPAYMENTS_API_KEY?.trim();
  if (!key) throw new Error("NOWPAYMENTS_API_KEY is missing from the server environment.");
  return key;
}

function callbackUrl() {
  const configured = process.env.NOWPAYMENTS_IPN_CALLBACK_URL?.trim();
  if (configured) return configured;
  const secret = process.env.NOWPAYMENTS_IPN_SECRET?.trim();
  if (!secret) throw new Error("NOWPAYMENTS_IPN_SECRET is missing from the server environment.");
  return `${siteUrl()}/api/webhooks/nowpayments/${encodeURIComponent(secret)}`;
}

export function toNowPaymentsCurrency(asset: string, network: string) {
  const key = `${asset.trim().toUpperCase()}_${network.trim().toUpperCase()}`;
  const mapping: Record<string,string> = {
    USDT_BEP20: "usdtbsc",
    USDT_TRC20: "usdttrc20",
    USDT_ERC20: "usdterc20",
    USDT_SOL: "usdtsol",
    USDC_BEP20: "usdcbsc",
    USDC_SOL: "usdcsol",
    BTC_BTC: "btc",
  };
  return mapping[key] ?? null;
}

export async function createNowPaymentsPayment(input: CreatePaymentInput) {
  const response = await fetch(`${API_BASE}/v1/payment`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      price_amount: input.amountUsd,
      price_currency: "usd",
      pay_currency: input.payCurrency,
      ipn_callback_url: callbackUrl(),
      order_id: input.orderId,
      order_description: input.description,
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as NowPaymentsResponse & { message?: string };
  if (!response.ok || !data.payment_id || !data.pay_address || !data.pay_amount) {
    throw new Error(data.message || "NOWPayments could not create the crypto payment.");
  }

  return {
    paymentId: String(data.payment_id),
    status: String(data.payment_status || "waiting"),
    payAddress: String(data.pay_address),
    payAmount: String(data.pay_amount),
    payCurrency: String(data.pay_currency || input.payCurrency).toUpperCase(),
    expiresAt: data.expiration_estimate_date || null,
    createdAt: data.created_at || new Date().toISOString(),
  };
}

export async function getNowPaymentsPayment(paymentId: string) {
  const response = await fetch(`${API_BASE}/v1/payment/${encodeURIComponent(paymentId)}`, {
    headers: { "x-api-key": apiKey(), Accept: "application/json" },
    cache: "no-store",
  });
  const data = (await response.json()) as NowPaymentsResponse & { message?: string };
  if (!response.ok) throw new Error(data.message || "Unable to retrieve NOWPayments payment status.");
  return {
    paymentId: String(data.payment_id || paymentId),
    status: String(data.payment_status || "waiting").toLowerCase(),
    payAddress: data.pay_address ? String(data.pay_address) : null,
    payAmount: data.pay_amount ? String(data.pay_amount) : null,
    payCurrency: data.pay_currency ? String(data.pay_currency).toUpperCase() : null,
    txid: data.payin_hash ? String(data.payin_hash) : null,
    updatedAt: data.updated_at || null,
  };
}
