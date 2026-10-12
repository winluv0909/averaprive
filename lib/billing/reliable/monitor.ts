import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyBinanceCredit } from "./binance";
import { discover, snapshotChain, verifyTransaction } from "./chain";
import { pairs, pairConfig } from "./config";
import { canonical, type PaymentOrder } from "./domain";
import { deliverNotifications } from "./notifications";
export async function monitorPayments() {
  const db=createAdminClient(),worker=randomUUID();
  const claim=await db.rpc("ap_claim_crypto_monitor",{worker,batch_size:12});
  if(claim.error) throw new Error("Payment monitor could not claim invoices");
  let checked=0,errors=0;
  const snapshots=new Map<string,Promise<string>>();
  const discoveries=new Map<string,ReturnType<typeof discover>>();
  const transactions=new Map<string,ReturnType<typeof verifyTransaction>>();
  const credits=new Map<string,ReturnType<typeof verifyBinanceCredit>>();
  function cached<T>(cache:Map<string,Promise<T>>,key:string,read:()=>Promise<T>):Promise<T>{
    let result=cache.get(key);if(!result){result=read();cache.set(key,result);}return result;
  }
  async function check(order:PaymentOrder & {submitted_txid:string|null}) {
    let cursor=order.scan_cursor,error:string|null=null;
    try {
      const pairKey=`${order.crypto_asset}:${order.crypto_network}:${order.token_contract}:${order.token_decimals}`;
      await cached(snapshots,pairKey,()=>snapshotChain(pairConfig(order.crypto_asset,order.crypto_network)));
      const discoveryKey=`${pairKey}:${order.receiving_address}:${order.scan_cursor}:${order.crypto_network==="TRC20"?order.created_at:""}`;
      const found=await cached(discoveries,discoveryKey,()=>discover(order)); cursor=found.cursor;
      const txids=[...new Set([...found.txids,order.verified_transaction_hash,order.submitted_txid].filter((v):v is string=>Boolean(v)))];
      let activated=false;
      for(const txid of txids) {
        let observations=await cached(transactions,`${pairKey}:${txid}`,()=>verifyTransaction(order,txid));
        if(!observations.length && txid===order.submitted_txid) {
          // Cross-network support lookup is a hint only and cannot approve payment.
          for(const pair of pairs.filter(p=>p.startsWith(order.crypto_asset+"_") && !p.endsWith("_"+order.crypto_network))) {
            const [asset,network]=pair.split("_");
            if(network==="SOL" || order.crypto_network==="SOL" || (network==="TRC20")!==(order.crypto_network==="TRC20")) continue;
            let other;try {other=pairConfig(asset,network);} catch {continue;}
            await snapshotChain(other);
            observations=await verifyTransaction({...order,crypto_network:other.network,token_contract:other.token,token_decimals:other.decimals},txid);
            if(observations.length) break;
          }
        }
        // An RPC receipt is evidence; a submitted hash is only a lookup hint.
        for(const observation of observations) {
          const related=canonical(observation.destination,order.crypto_network)===canonical(order.receiving_address,order.crypto_network);
          if(!related && txid!==order.submitted_txid) continue;
          const credit=order.receiving_provider==="binance" && related && observation.network===order.crypto_network && canonical(observation.token,order.crypto_network)===canonical(order.token_contract,order.crypto_network)?await cached(credits,`${pairKey}:${observation.destination}:${observation.txid}:${observation.amount}`,()=>verifyBinanceCredit(order,observation)):{};
          const evidence={...observation,...credit,token:canonical(observation.token,order.crypto_network),destination:canonical(observation.destination,order.crypto_network),hint_only:!related};
          const recorded=await db.rpc("ap_record_crypto_evidence",{target_order:order.id,worker,evidence});
          if(recorded.error) throw new Error("Payment evidence could not be saved");
          if(recorded.data==="confirmed") {activated=true;break;}
        }
        if(activated) break;
      }
      checked++;
    } catch { error="Blockchain verification or evidence storage failed. No payment was approved. Check blockchain, Binance and database configuration and retry."; errors++; }
    const finished=await db.rpc("ap_finish_crypto_monitor",{target_order:order.id,worker,next_cursor:cursor,error_note:error});
    if(finished.error) errors++;
  }
  const orders=(claim.data||[]) as (PaymentOrder & {submitted_txid:string|null})[];
  // Bounded concurrency avoids a single slow invoice blocking every other customer.
  for(let start=0;start<orders.length;start+=4) await Promise.all(orders.slice(start,start+4).map(check));
  const email=await deliverNotifications();
  return {checked,errors,email};
}
