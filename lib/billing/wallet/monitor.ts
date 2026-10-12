import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { canonical, type PaymentOrder } from "@/lib/billing/reliable/domain";
import { deliverNotifications } from "@/lib/billing/reliable/notifications";
import { walletChannels, walletConfig } from "./config";
import { walletSnapshot, walletDiscover, walletVerify } from "./chain";
export async function monitorWalletPayments() {
  const db = createAdminClient(), worker = randomUUID();
  const claimed = await db.rpc("ap_claim_trust_wallet_monitor", {worker, batch_size: 4});
  if (claimed.error) throw new Error("Wallet payment queue unavailable");
  let checked = 0, errors = 0;
  const deadline = Date.now() + 180000;
  const snapshots = new Map<string, Promise<string>>();
  for (const order of (claimed.data || []) as (PaymentOrder & {submitted_txid: string | null})[]) {
    let cursor = order.scan_cursor, error: string | null = null;
    try {
      const key = `${order.crypto_asset}_${order.crypto_network}`, config = walletConfig(order.crypto_asset, order.crypto_network);
      if (!snapshots.has(key)) snapshots.set(key, walletSnapshot(config));
      await snapshots.get(key);
      const found = await walletDiscover(order); cursor = found.cursor;
      const hashes = [...new Set([order.verified_transaction_hash, order.submitted_txid, ...found.txids].filter((v): v is string => Boolean(v)))];
      // Never skip an overflowing page: retain the cursor so subsequent runs retry it.
      if (hashes.length > 100) throw new Error("Too many deposits for this worker batch; dedicated indexing required");
      let activated = false;
      for (const hash of hashes) {
        if (Date.now() > deadline) throw new Error("Worker budget reached; retry without advancing the scan cursor");
        let observations = await walletVerify(order, hash);
        // An off-network hint is only support evidence; it can never match this invoice.
        if (!observations.length && hash === order.submitted_txid && hash.startsWith("0x")) {
          for (const alternative of walletChannels.filter(c => c.asset === order.crypto_asset && c.network !== order.crypto_network && ["ERC20", "BEP20", "ARBITRUM", "BASE"].includes(c.network))) {
            if (Date.now() > deadline) throw new Error("Worker budget reached");
            let other;
            try { other = walletConfig(alternative.asset, alternative.network); } catch { continue; }
            await walletSnapshot(other);
            observations = await walletVerify({...order, crypto_network: other.network, token_contract: other.token, token_decimals: other.decimals}, hash);
            if (observations.length) break;
          }
        }
        for (const observation of observations) {
          const related = canonical(observation.destination, order.crypto_network) === canonical(order.receiving_address, order.crypto_network);
          if (!related && hash !== order.submitted_txid) continue;
          const evidence = {...observation, token: canonical(observation.token, order.crypto_network), destination: canonical(observation.destination, order.crypto_network), hint_only: !related || observation.network !== order.crypto_network};
          const result = await db.rpc("ap_record_trust_wallet_evidence", {target_order: order.id, worker, evidence});
          if (result.error) throw new Error("Independent evidence could not be stored");
          if (result.data === "confirmed") { activated = true; break; }
        }
        if (activated) break;
      }
      checked++;
    } catch { errors++; error = "Blockchain verification is unavailable. No payment was approved. Check the wallet RPC/indexer, migration and worker configuration."; }
    const finish = await db.rpc("ap_finish_crypto_monitor", {target_order: order.id, worker, next_cursor: cursor, error_note: error});
    if (finish.error) errors++;
  }
  const email = await deliverNotifications();
  return {checked, errors, email};
}
