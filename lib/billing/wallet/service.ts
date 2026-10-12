import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingSeller } from "@/lib/billing/config";
import { createCryptoQuote } from "@/lib/billing/crypto-quote";
import { walletConfig } from "./config";
import { walletSnapshot } from "./chain";
export class WalletCheckoutError extends Error {
  constructor(public readonly reference: string, public readonly reason: string) { super("Crypto invoice could not be created"); }
}
const databaseReasons: Record<string,string> = {
  "Agency billing membership required": "Agency billing membership could not be verified",
  "Complete billing information": "Complete the billing information",
  "Plan unavailable": "Selected plan is unavailable",
  "Authoritative plan price mismatch": "Selected price does not match the database plan",
  "Token, network or receiving wallet mismatch": "Receiving configuration does not match migration 025",
  "Checkout request already used for different details": "Reload checkout to obtain a new request",
  "Invalid payment invoice": "Invoice information failed validation",
  "Invalid quote precision": "Crypto quote precision is invalid",
  "Stablecoin quote mismatch": "Stablecoin quote does not match the plan",
  "Invalid Bitcoin price quote": "Bitcoin quote failed price or freshness checks",
  "Exact amount allocation exhausted; receiving address rotation required": "Receiving amount allocation requires billing support",
};
function databaseFailure(stage: string, error: {code?: string; message?: string} | null): never {
  const code = /^[A-Z0-9]{2,12}$/.test(error?.code || "") ? error!.code : "UNKNOWN";
  throw new WalletCheckoutError(`WC_${stage}_${code}`, databaseReasons[error?.message || ""] || "Database request failed; report this reference to billing support");
}
export async function prepareWalletCheckout(input: Record<string, string>) {
  let stage = "CONFIGURATION";
  try {
  const config = walletConfig(input.crypto_asset, input.crypto_network), db = createAdminClient();
  stage = "LOOKUP";
  const previous = await db.from("ap_payment_orders").select("id,agency_id,created_by,plan_code,billing_cycle,crypto_asset,crypto_network,wallet_generation,payer_company_name,payer_email,payer_billing_address,status,payment_expires_at").eq("checkout_request_id", input.request_id).maybeSingle();
  if (previous.error) databaseFailure(stage, previous.error);
  if (previous.data) {
    const p = previous.data;
    if (p.wallet_generation !== "trust_wallet_v1" || p.agency_id !== input.agency_id || p.created_by !== input.created_by || p.plan_code !== input.plan_code || p.billing_cycle !== input.billing_cycle || p.crypto_asset !== config.asset || p.crypto_network !== config.network || p.payer_company_name !== input.legal_name || p.payer_email !== input.billing_email || p.payer_billing_address !== input.billing_address) throw new Error("Checkout request already used for different information");
    return {id: p.id};
  }
  stage = "PLAN";
  const plan = await db.from("ap_plans").select("name,monthly_price_usd,annual_price_usd").eq("code", input.plan_code).eq("active", true).single();
  if (plan.error || !plan.data) databaseFailure(stage, plan.error);
  const total = Number(input.billing_cycle === "annual" ? plan.data.annual_price_usd : plan.data.monthly_price_usd);
  stage = "QUOTE";
  const quote = await createCryptoQuote(config.asset === "BTC" ? "bitcoin" : config.asset === "USDT" ? "usdt" : "usdc", total);
  stage = "BLOCKCHAIN";
  const scan = await walletSnapshot(config);
  stage = "SAVE";
  const result = await db.rpc("ap_create_trust_wallet_invoice", {input: {...input, checkout_request_id: input.request_id,
    payer_full_name: input.full_name, payer_company_name: input.legal_name, payer_email: input.billing_email, payer_billing_address: input.billing_address,
    crypto_asset: config.asset, crypto_network: config.network, token_contract: config.token, token_decimals: config.decimals,
    required_confirmations: config.confirmations, expected_crypto_amount: quote.cryptoAmount, total_amount: total.toFixed(2), plan_name: plan.data.name,
    scan_cursor: scan, payment_expires_at: quote.expiresAt, quoted_at: quote.quotedAt, usd_rate: quote.usdRate, rate_source: quote.rateSource, receiving_provider: "wallet"}, addresses: config.addresses, seller: billingSeller});
  if (result.error || !result.data?.order_id) databaseFailure(stage, result.error);
  return {id: result.data.order_id as string};
  } catch (error) {
    if (error instanceof WalletCheckoutError) throw error;
    // No raw RPC/database errors, URLs, credentials or customer information are exposed.
    throw new WalletCheckoutError(`WC_${stage}`, `Checkout failed during ${stage.toLowerCase()}. Report this reference to billing support`);
  }
}
