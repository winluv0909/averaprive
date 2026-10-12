import "server-only";
import { unitsDecimal, type Observation, type PaymentOrder } from "@/lib/billing/reliable/domain";
import { walletConfig } from "./config";
interface BitcoinTransaction { txid: string; vin: Array<{prevout?: {scriptpubkey_address?: string}}>; vout: Array<{scriptpubkey_address?: string; value: number}>; status: {confirmed: boolean; block_height?: number; block_hash?: string; block_time?: number}; }
export const bitcoinGenesis = "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f";
async function read(base: string, path: string, text = false) {
  const response = await fetch(base.replace(/\/$/, "") + path, { cache: "no-store", signal: AbortSignal.timeout(12000), redirect: "error" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Bitcoin verification service unavailable");
  return text ? (await response.text()).trim() : response.json();
}
export async function bitcoinSnapshot(): Promise<string> {
  const config = walletConfig("BTC", "BITCOIN"), bases = [config.rpcUrl, process.env.WALLET_BTC_SECONDARY_URL!];
  const hashes = await Promise.all(bases.map(base => read(base, "/block-height/0", true)));
  if (hashes.some(hash => hash !== bitcoinGenesis)) throw new Error("Bitcoin endpoint is not mainnet");
  const head = await read(config.rpcUrl, "/blocks/tip/height", true);
  if (!/^\d+$/.test(String(head))) throw new Error("Invalid Bitcoin block height");
  return String(head);
}
export async function verifyBitcoin(order: PaymentOrder, txid: string): Promise<Observation[]> {
  if (!/^[a-f0-9]{64}$/i.test(txid)) return [];
  const config = walletConfig("BTC", "BITCOIN"), bases = [config.rpcUrl, process.env.WALLET_BTC_SECONDARY_URL!];
  const results = await Promise.all(bases.map(base => read(base, `/tx/${txid.toLowerCase()}`))) as Array<BitcoinTransaction | null>;
  if (results.some(tx => !tx)) return [];
  const [tx, other] = results as BitcoinTransaction[];
  if (tx.txid !== txid.toLowerCase() || other.txid !== tx.txid || JSON.stringify(tx.vout) !== JSON.stringify(other.vout)) throw new Error("Bitcoin providers disagree about transaction outputs");
  // Self-transfers/change from our receiving address cannot be used as customer payments.
  if (tx.vin.some(input => input.prevout?.scriptpubkey_address === order.receiving_address)) return [];
  let confirmations = 0, finalized = false;
  if (tx.status.confirmed && other.status.confirmed) {
    const height = tx.status.block_height;
    if (!Number.isSafeInteger(height) || !height || tx.status.block_hash !== other.status.block_hash || height !== other.status.block_height || tx.status.block_time !== other.status.block_time) throw new Error("Bitcoin providers disagree about block inclusion");
    const canonical = await Promise.all(bases.map(base => read(base, `/block-height/${height}`, true)));
    if (canonical.some(hash => hash !== tx.status.block_hash)) return []; // Reorg: never approve.
    const heads = await Promise.all(bases.map(base => read(base, "/blocks/tip/height", true)));
    if (heads.some(head => !/^\d+$/.test(String(head)))) throw new Error("Invalid Bitcoin chain tip");
    confirmations = Math.max(0, Math.min(...heads.map(Number)) - height + 1);
    finalized = confirmations >= config.confirmations; // Bitcoin has probabilistic confirmations.
  }
  const outputs = tx.vout.map((out, index) => ({...out, index})).filter(out => out.scriptpubkey_address === order.receiving_address);
  if (!outputs.length || outputs.some(out => !Number.isSafeInteger(out.value) || out.value < 0)) return [];
  const received = outputs.reduce((sum, out) => sum + BigInt(out.value), BigInt(0));
  return [{ txid: tx.txid, network: "BITCOIN", token: "BTC", destination: order.receiving_address, amount: unitsDecimal(received, 8), amount_decimals: 8, amount_raw: received.toString(),
    confirmations, finalized, successful: true, block_hash: finalized || tx.status.confirmed ? tx.status.block_hash || "" : "mempool",
    block_number: String(tx.status.block_height || 0), transaction_at: new Date(tx.status.confirmed ? (tx.status.block_time || 0) * 1000 : Date.now()).toISOString(), transfer_index: outputs.length === 1 ? outputs[0].index : -1 }];
}
export async function discoverBitcoin(order: PaymentOrder): Promise<{txids: string[]; cursor: string | null}> {
  const config = walletConfig("BTC", "BITCOIN"), txids = new Set<string>();
  const info = await read(config.rpcUrl, `/address/${order.receiving_address}`) as {mempool_stats?: {tx_count: number}} | null;
  if (!info || Number(info.mempool_stats?.tx_count || 0) > 50) throw new Error("Bitcoin mempool history limit reached; support review required");
  const mempool = await read(config.rpcUrl, `/address/${order.receiving_address}/txs/mempool`) as BitcoinTransaction[];
  for (const tx of mempool) txids.add(tx.txid);
  let last = "";
  for (let page = 0; page < 20; page++) {
    const list = await read(config.rpcUrl, `/address/${order.receiving_address}/txs/chain${last ? "/" + last : ""}`) as BitcoinTransaction[];
    for (const tx of list) if ((tx.status.block_time || 0) * 1000 >= Date.parse(order.created_at) - 120000) txids.add(tx.txid);
    if (list.length < 25 || list.some(tx => (tx.status.block_time || 0) * 1000 < Date.parse(order.created_at) - 120000)) return { txids: [...txids], cursor: order.scan_cursor };
    last = list[list.length - 1].txid;
  }
  throw new Error("Bitcoin address history requires a larger indexer; payment remains unconfirmed");
}
