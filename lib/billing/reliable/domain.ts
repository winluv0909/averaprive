export type Network = "BEP20" | "ERC20" | "TRC20" | "SOL" | "ARBITRUM" | "BASE" | "BITCOIN";
export type Asset = "USDT" | "USDC" | "BTC";
export type PaymentState = "awaiting_payment" | "detected" | "confirming" | "confirmed" | "underpaid" | "overpaid" | "wrong_token" | "wrong_network" | "wrong_destination" | "duplicate_txid" | "expired" | "late_payment" | "failed_on_chain" | "manual_review" | "matching_review";
export interface PaymentOrder {
  receiving_mode?: "dedicated"|"shared";
  receiving_provider?: "wallet"|"binance";
  id: string; agency_id: string; crypto_asset: Asset; crypto_network: Network;
  receiving_address: string; token_contract: string; token_decimals: number;
  expected_crypto_amount: string; required_confirmations: number; payment_expires_at: string;
  created_at: string; scan_cursor: string | null; current_crypto_status: PaymentState;
  transaction_hash: string | null; verified_transaction_hash: string | null;
  status: string;
}
export interface Observation {
  custodian_credit?: boolean; custodian_deposit_id?: string|null;
  amount_decimals?: number; amount_raw?: string;
  txid: string; network: Network; token: string; destination: string; amount: string;
  confirmations: number; finalized: boolean; successful: boolean; block_hash: string;
  block_number: string; transaction_at: string; transfer_index: number;
}
export const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export function decimalUnits(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 30 || !/^\d+(\.\d+)?$/.test(value)) throw new Error("Invalid token amount");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals))) throw new Error("Amount exceeds token precision");
  return BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt((fraction.slice(0, decimals).padEnd(decimals, "0")) || "0");
}
export function unitsDecimal(units: bigint, decimals: number): string {
  if (units < BigInt(0)) throw new Error("Negative transfer amount");
  const digits = units.toString().padStart(decimals + 1, "0");
  return decimals === 0 ? digits : `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
}
export function canonical(value: string, network: Network): string { return ["BEP20", "ERC20", "ARBITRUM", "BASE"].includes(network) ? value.toLowerCase() : value; }
export function evaluate(order: PaymentOrder, observation: Observation): PaymentState {
  if (observation.network !== order.crypto_network) return "wrong_network";
  if (canonical(observation.destination, order.crypto_network) !== canonical(order.receiving_address, order.crypto_network)) return "wrong_destination";
  if (canonical(observation.token, order.crypto_network) !== canonical(order.token_contract, order.crypto_network)) return "wrong_token";
  if (!observation.successful) return "failed_on_chain";
  const at = Date.parse(observation.transaction_at);
  if (!Number.isFinite(at) || at < Date.parse(order.created_at) - 120000) return "manual_review";
  if (at > Date.parse(order.payment_expires_at)) return "late_payment";
  const actual = decimalUnits(observation.amount, order.token_decimals);
  const expected = decimalUnits(String(order.expected_crypto_amount), order.token_decimals);
  if (actual < expected) return "underpaid";
  if (actual > expected) return "overpaid";
  if (observation.confirmations < order.required_confirmations || !observation.finalized || (order.receiving_provider==="binance" && !observation.custodian_credit)) return observation.confirmations > 0 ? "confirming" : "detected";
  return "confirmed";
}
export function validHint(txid: string, network: Network): boolean {
  return network === "SOL" ? /^[1-9A-HJ-NP-Za-km-z]{80,100}$/.test(txid) : ["TRC20", "BITCOIN"].includes(network) ? /^[0-9a-f]{64}$/i.test(txid) : /^0x[0-9a-f]{64}$/i.test(txid);
}
