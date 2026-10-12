import "server-only";
import { suppliedBinanceReceivers } from "./receivers";
import { createHash } from "node:crypto";
import type { Asset, Network } from "./domain";
export const pairs = ["USDT_BEP20","USDT_TRC20","USDT_ERC20","USDT_SOL","USDC_BEP20","USDC_ERC20","USDC_SOL","BTC_BEP20","BTC_ERC20"];
export interface PairConfig { asset: Asset; network: Network; token: string; decimals: number; addresses: string[]; confirmations: number; rpcUrl: string; receivingProvider?: "wallet"|"binance"; }
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58decode(value: string): Buffer {
  let n = BigInt(0); for (const c of value) { const digit = alphabet.indexOf(c); if (digit < 0) throw new Error("Invalid base58 address"); n = n * BigInt(58) + BigInt(digit); }
  let hex = n.toString(16); if (hex.length % 2) hex = "0" + hex;
  const raw = n === BigInt(0) ? Buffer.alloc(0) : Buffer.from(hex, "hex");
  return Buffer.concat([Buffer.alloc(value.match(/^1*/)?.[0].length || 0), raw]);
}
export function base58encode(bytes: Buffer): string {
  let n = BigInt("0x" + (bytes.toString("hex") || "0")); let out = "";
  while (n > BigInt(0)) { out = alphabet[Number(n % BigInt(58))] + out; n /= BigInt(58); }
  for (const byte of bytes) { if (byte !== 0) break; out = "1" + out; } return out;
}
const sha = (v: Buffer) => createHash("sha256").update(v).digest();
export function tronHex(address: string): string {
  const data = base58decode(address);
  if (data.length !== 25 || data[0] !== 0x41 || !sha(sha(data.subarray(0,21))).subarray(0,4).equals(data.subarray(21))) throw new Error("Invalid TRON address checksum");
  return data.subarray(1,21).toString("hex");
}
export function tronAddress(hex: string): string {
  const body = Buffer.from("41" + hex.replace(/^0x/, "").slice(-40), "hex");
  return base58encode(Buffer.concat([body, sha(sha(body)).subarray(0,4)]));
}
export function checkAddress(value: string, network: Network): string {
  if (network === "BEP20" || network === "ERC20") {
    if (!/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/i.test(value)) throw new Error("Invalid EVM receiving address");
    return value.toLowerCase();
  }
  if (network === "TRC20") { tronHex(value); return value; }
  if (base58decode(value).length !== 32) throw new Error("Invalid Solana address"); return value;
}
export function pairConfig(asset: string, network: string): PairConfig {
  const pair = `${asset.toUpperCase()}_${network.toUpperCase()}`;
  if (!pairs.includes(pair)) throw new Error("Unsupported asset/network combination");
  const [a, n] = pair.split("_") as [Asset, Network];
  const rpcUrl = process.env[`CRYPTO_RPC_${n}`]?.trim();
  const token = process.env[`CRYPTO_TOKEN_${pair}`]?.trim();
  const decimals = Number(process.env[`CRYPTO_DECIMALS_${pair}`]);
  if (!rpcUrl || !token || !process.env[`CRYPTO_DECIMALS_${pair}`] || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error(`Complete RPC, token and decimal configuration for ${pair}`);
  if ((n==="SOL" && !process.env.CRYPTO_GENESIS_SOL) || (n==="TRC20" && !process.env.CRYPTO_GENESIS_TRC20)) throw new Error("Configure the expected network genesis hash");
  const url = new URL(rpcUrl); if (url.protocol !== "https:") throw new Error("Blockchain RPC must use HTTPS");
  let list: unknown = []; try { list = JSON.parse(process.env[`CRYPTO_WALLETS_${pair}`] || JSON.stringify(suppliedBinanceReceivers[pair]||[])); } catch { throw new Error(`Invalid receiving-address pool for ${pair}`); }
  if (!Array.isArray(list) || !list.length || !list.every(v => typeof v === "string")) throw new Error(`Configure an address pool for ${pair}`);
  if (n==="SOL" && Number(process.env.CRYPTO_CONFIRMATIONS_SOL||32)!==32) throw new Error("Solana uses finalized status; custom confirmation counts are unsupported");
  const confirmations = Math.max(n === "TRC20" ? 20 : n === "SOL" ? 32 : 12, Number(process.env[`CRYPTO_CONFIRMATIONS_${n}`] || 0));
  if (!Number.isSafeInteger(confirmations)) throw new Error("Invalid required confirmations");
  const addresses=[...new Set(list.map(v => checkAddress(v,n)))];
  const knownBinance=Object.values(suppliedBinanceReceivers).flat().some(v=>addresses.some(a=>a.toLowerCase()===v.toLowerCase()));
  return { receivingProvider:process.env.CRYPTO_CUSTODIAN==="wallet" && !knownBinance?"wallet":"binance", asset:a, network:n, token:checkAddress(token,n), decimals, rpcUrl, addresses, confirmations };
}
export function reliablePairs(): string[] {
  return pairs.filter(p => { try { const [a,n]=p.split("_"); const config=pairConfig(a,n); if(config.receivingProvider==="binance" && (!process.env.BINANCE_READ_API_KEY || !process.env.BINANCE_READ_API_SECRET)) return false; return a !== "BTC" || Boolean(process.env.TATUM_API_KEY?.trim()); } catch { return false; } });
}
