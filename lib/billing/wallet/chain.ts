import "server-only";
import { rpc, tron, verifyEvm, verifyTron } from "@/lib/billing/reliable/chain";
import { canonical, decimalUnits, transferTopic, unitsDecimal, type Observation, type PaymentOrder } from "@/lib/billing/reliable/domain";
import type { PairConfig } from "@/lib/billing/reliable/config";
import { walletConfig, evmChainIds, tronMainnetGenesis } from "./config";
import { bitcoinSnapshot, discoverBitcoin, verifyBitcoin } from "./bitcoin";
interface Block {number: string; hash: string;}
export async function walletSnapshot(config: PairConfig): Promise<string> {
  if (config.network === "BITCOIN") return bitcoinSnapshot();
  if (config.network in evmChainIds) {
    if (Number(BigInt(await rpc<string>(config, "eth_chainId", []))) !== evmChainIds[config.network]) throw new Error("Wrong blockchain RPC network");
    const decimals = Number(BigInt(await rpc<string>(config, "eth_call", [{to: config.token, data: "0x313ce567"}, "latest"])));
    if (decimals !== config.decimals) throw new Error("Token contract decimals mismatch");
    if (!(await rpc<Block | null>(config, "eth_getBlockByNumber", ["finalized", false]))?.number) throw new Error("RPC must expose finalized blocks");
    return BigInt(await rpc<string>(config, "eth_blockNumber", [])).toString();
  }
  const genesis = await tron<{blockID: string}>(config, "wallet/getblockbynum", {num: 0});
  if (genesis.blockID !== tronMainnetGenesis) throw new Error("Wrong TRON mainnet genesis");
  const result = await tron<{constant_result?: string[]; result?: {result: boolean}}>(config, "wallet/triggerconstantcontract", {owner_address: config.addresses[0], contract_address: config.token, function_selector: "decimals()", visible: true});
  if (!result.result?.result || Number(BigInt("0x" + (result.constant_result?.[0] || ""))) !== config.decimals) throw new Error("TRON token decimals mismatch");
  const block = await tron<{block_header: {raw_data: {number: number}}}>(config, "wallet/getnowblock", {});
  return String(block.block_header.raw_data.number);
}
export async function walletVerify(order: PaymentOrder, txid: string): Promise<Observation[]> {
  const config = walletConfig(order.crypto_asset, order.crypto_network);
  if (canonical(config.token, config.network) !== canonical(order.token_contract, config.network) || config.decimals !== order.token_decimals || !config.addresses.includes(canonical(order.receiving_address, config.network))) throw new Error("Invoice wallet configuration mismatch");
  const observations = config.network === "BITCOIN" ? await verifyBitcoin(order, txid) : config.network === "TRC20" ? await verifyTron(config, txid) : await verifyEvm(config, txid);
  const grouped = new Map<string, Observation>();
  for (const observation of observations) {
    const key = canonical(observation.token, config.network) + ":" + canonical(observation.destination, config.network), existing = grouped.get(key);
    if (existing) {
      const decimals = existing.amount_decimals ?? config.decimals;
      existing.amount = unitsDecimal(decimalUnits(existing.amount, decimals) + decimalUnits(observation.amount, decimals), decimals);
      existing.amount_raw = decimalUnits(existing.amount, decimals).toString(); existing.transfer_index = -1;
    } else grouped.set(key, {...observation});
  }
  return [...grouped.values()];
}
export async function walletDiscover(order: PaymentOrder): Promise<{txids: string[]; cursor: string | null}> {
  const config = walletConfig(order.crypto_asset, order.crypto_network);
  if (config.network === "BITCOIN") return discoverBitcoin(order);
  if (config.network in evmChainIds) {
    const head = BigInt(await rpc<string>(config, "eth_blockNumber", [])), saved = BigInt(order.scan_cursor || "0");
    const overlap = BigInt(config.confirmations + 2), from = saved > overlap ? saved - overlap : BigInt(0);
    if (from > head) return {txids: [], cursor: order.scan_cursor};
    // Free-tier queries cover at most ten blocks. Scan multiple pages so the
    // confirmation overlap cannot pin the cursor behind its previous position.
    const to = from + BigInt(199) < head ? from + BigInt(199) : head;
    const txids = new Set<string>();
    for (let first = from; first <= to; first += BigInt(10)) {
      const last = first + BigInt(9) < to ? first + BigInt(9) : to;
      await new Promise(resolve => setTimeout(resolve, 100));
      const logs = await rpc<Array<{removed?: boolean; transactionHash: string}>>(config, "eth_getLogs", [{fromBlock: "0x" + first.toString(16), toBlock: "0x" + last.toString(16), address: config.token, topics: [transferTopic, null, "0x" + order.receiving_address.slice(2).padStart(64, "0")]}]);
      for (const log of logs) if (!log.removed) txids.add(log.transactionHash);
    }
    // A failed page throws before returning a cursor; the worker keeps the old one.
    return {txids: [...txids], cursor: (to > saved ? to : saved).toString()};
  }
  const txids = new Set<string>(); let fingerprint: string | undefined;
  for (let page = 0; page < 10; page++) {
    const url = new URL(config.rpcUrl.replace(/\/$/, "") + `/v1/accounts/${encodeURIComponent(order.receiving_address)}/transactions/trc20`);
    url.searchParams.set("limit", "200"); url.searchParams.set("min_timestamp", String(Date.parse(order.created_at) - 120000)); url.searchParams.set("contract_address", config.token);
    if (fingerprint) url.searchParams.set("fingerprint", fingerprint);
    const response = await fetch(url, {cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000), headers: process.env.TRONGRID_API_KEY ? {"TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY} : {}});
    if (!response.ok) throw new Error("TRON history unavailable");
    const result = await response.json() as {data: Array<{transaction_id: string; to: string}>; meta?: {fingerprint?: string; links?: {next?: string}}};
    for (const tx of result.data) if (tx.to === order.receiving_address) txids.add(tx.transaction_id);
    if (!result.meta?.links?.next) return {txids: [...txids], cursor: order.scan_cursor};
    fingerprint = result.meta.fingerprint; if (!fingerprint) throw new Error("Incomplete TRON history");
  }
  throw new Error("TRON history limit reached; support review required");
}
