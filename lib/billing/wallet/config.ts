import "server-only";
import { tronHex, type PairConfig } from "@/lib/billing/reliable/config";
export const evmReceiver = "0x7A71cFBDC7D37D9520445bff3634cbDA889F904d";
export const bitcoinReceiver = "bc1qyxpxwhmd8w39xndgnvu9wfq6d57sa7t7u9c42h";
export const walletChannels = [
  { asset: "USDT", network: "ERC20", label: "USDT · Ethereum (ERC20)", token: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, address: evmReceiver, confirmations: 12 },
  { asset: "USDT", network: "TRC20", label: "USDT · Tron (TRC20)", token: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", decimals: 6, address: "TQmrKedVwf3yfvmLUcsPbnWsWHFkSFVZnq", confirmations: 20 },
  { asset: "USDT", network: "BEP20", label: "USDT · BNB Smart Chain (BEP20)", token: "0x55d398326f99059fF775485246999027B3197955", decimals: 18, address: evmReceiver, confirmations: 12 },
  { asset: "USDC", network: "ARBITRUM", label: "USDC · Arbitrum One (native USDC)", token: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6, address: evmReceiver, confirmations: 12 },
  { asset: "USDC", network: "ERC20", label: "USDC · Ethereum (ERC20)", token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, address: evmReceiver, confirmations: 12 },
  { asset: "USDC", network: "BASE", label: "USDC · Base (native USDC)", token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, address: evmReceiver, confirmations: 12 },
  { asset: "BTC", network: "BITCOIN", label: "BTC · Bitcoin (native BTC)", token: "BTC", decimals: 8, address: bitcoinReceiver, confirmations: 6 },
] as const;
export const tronMainnetGenesis = "00000000000000001ebf88508a03865c71d452e25f4d51194196a1d22b6653dc";
export const evmChainIds: Record<string, number> = { ERC20: 1, BEP20: 56, ARBITRUM: 42161, BASE: 8453 };
export function bitcoinAddressValid(value: string): boolean {
  // Only mainnet native SegWit v0, 20-byte receiving addresses are configured here.
  if (!/^bc1q[023456789acdefghjklmnpqrstuvwxyz]{38}$/.test(value)) return false;
  const alphabet = "qpzry9x8gf2tvdw0s3jn54khce6mua7l", generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let checksum = 1;
  for (const digit of [3, 3, 0, 2, 3, ...[...value.slice(3)].map(c => alphabet.indexOf(c))]) {
    const top = checksum >>> 25; checksum = ((checksum & 0x1ffffff) << 5) ^ digit;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) checksum ^= generators[i];
  }
  return (checksum >>> 0) === 1;
}
export function walletConfig(asset: string, network: string): PairConfig {
  if (process.env.WALLET_CRYPTO_ENABLED !== "true") throw new Error("Wallet checkout is not enabled");
  if ((process.env.CRYPTO_MONITOR_SECRET || "").length < 32) throw new Error("Configure the payment monitor secret");
  const channel = walletChannels.find(c => c.asset === asset && c.network === network);
  if (!channel) throw new Error("Unsupported wallet payment channel");
  const rpcUrl = process.env[`WALLET_RPC_${network}`]?.trim();
  if (!rpcUrl || new URL(rpcUrl).protocol !== "https:") throw new Error("Configure an HTTPS blockchain endpoint");
  if (network === "BITCOIN") {
    if (!bitcoinAddressValid(channel.address) || !process.env.TATUM_API_KEY?.trim()) throw new Error("Configure Bitcoin receiving address and price service");
    const second = process.env.WALLET_BTC_SECONDARY_URL?.trim();
    if (!second || new URL(second).protocol !== "https:" || new URL(second).host === new URL(rpcUrl).host) throw new Error("Configure a second independent Bitcoin Esplora endpoint");
  } else if (network === "TRC20") {
    tronHex(channel.address); tronHex(channel.token);

  }
  return { asset: channel.asset, network: channel.network, token: network in evmChainIds ? channel.token.toLowerCase() : channel.token,
    addresses: [network in evmChainIds ? channel.address.toLowerCase() : channel.address], decimals: channel.decimals,
    confirmations: channel.confirmations, rpcUrl, receivingProvider: "wallet" };
}
export function walletOptions() {
  return walletChannels.map(c => { let ready = false; try { walletConfig(c.asset, c.network); ready = true; } catch { /* unavailable channels stay disabled */ }
    return { key: `${c.asset}_${c.network}`, label: c.label, ready }; });
}
