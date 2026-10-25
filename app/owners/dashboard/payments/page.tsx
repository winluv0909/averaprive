import {walletOptions} from "@/lib/billing/wallet/config";
import Link from "next/link";
import {revalidatePath} from "next/cache";
import {requireStaffRole} from "@/lib/auth/authorization";
import {createAdminClient} from "@/lib/supabase/admin";
import {OwnerOperationsShell} from "@/app/dashboard/_components/portal-shells";
async function review(form:FormData) {
  "use server";
  const {supabase}=await requireStaffRole(["super_admin","finance"]);
  const {error}=await supabase.rpc("ap_review_payment_exception",{exception_id:String(form.get("exception_id")||""),note:String(form.get("note")||"")});
  if(error) throw new Error("The review note could not be saved. Provide at least 10 characters.");
  revalidatePath("/owners/dashboard/payments");
}
export default async function PaymentsPage() {
  const channels=walletOptions(), readyChannels=channels.filter(channel=>channel.ready);
  const {user}=await requireStaffRole(["super_admin","finance"]),db=createAdminClient();
  const [{data:orders,error},{data:exceptions},{data:deposits,error:depositError},{data:notices}]=await Promise.all([
    db.from("ap_payment_orders").select("*").in("provider",["crypto","paypal"]).order("created_at",{ascending:false}).limit(100),
    db.from("ap_payment_exceptions").select("*").order("created_at",{ascending:false}).limit(100),
    db.from("ap_shared_crypto_deposits").select("*").in("matching_state",["unmatched","ambiguous"]).order("updated_at",{ascending:false}).limit(100),
    db.from("ap_payment_notifications").select("id,order_id,event,status,last_error,attempts").neq("status","sent").limit(100),
  ]);
  if(error || depositError) throw new Error("Payment records unavailable. Apply the shared checkout database migration first.");
  return <OwnerOperationsShell active="subscriptions" email={user.email}><main className="owner-main"><h1>Payment review</h1><p>Live PayPal plans activate only after a verified completed capture. Sandbox payments do not change live access. Review notes do not approve a payment.</p><Link href="/owners/dashboard/subscriptions">Back to subscriptions</Link>
    <h2>Crypto checkout status</h2><p>{readyChannels.length ? `Crypto checkout is configured for ${readyChannels.length} payment channels. Configuration readiness does not confirm that the scheduled monitor is running.` : "Crypto checkout is unavailable. No payment channel currently passes the checkout configuration checks."}</p><ul>{channels.map(channel=><li key={channel.key}>{channel.label} · {channel.ready ? "Configured" : "Unavailable"}</li>)}</ul><p>Exact wallet payments are matched automatically after server verification. A submitted transaction hash or a review note cannot activate a plan. Confirm the scheduled crypto monitor is running before accepting payments.</p>
    <h2>Deposits requiring support review</h2><p>Check independent payer evidence and the linked invoice. Incorrect amounts, tokens, networks and late payments require support review. Manual invoice assignment is unavailable for the current wallet system.</p>
    {!deposits?.length&&<p>No deposits currently need matching.</p>}
    {deposits?.map(deposit=><section key={`${deposit.network}:${deposit.txid}:${deposit.token}:${deposit.destination}`}><h3>{deposit.matching_state} · {deposit.network} · {deposit.evidence?.amount}</h3><p style={{overflowWrap:"anywhere"}}>TXID: {deposit.txid}</p><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(deposit.evidence,null,2)}</pre><p style={{overflowWrap:"anywhere"}}>Candidate payment IDs: {Array.isArray(deposit.candidate_ids)?deposit.candidate_ids.join(", "):"None"}</p><p>Use the payment exceptions below to record your review. A review note does not settle the invoice or grant subscription access.</p></section>)}
    <h2>Payment records</h2>{orders?.map(order=><details key={order.id}><summary>{order.provider_reference||order.id} · {order.provider === "paypal" ? `${order.paypal_environment} / ${order.paypal_state}` : `${order.wallet_generation === "trust_wallet_v1" ? "Wallet crypto" : "Archived crypto"} / ${order.current_crypto_status}`} · {order.payer_company_name}</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(order,null,2)}</pre></details>)}
    <h2>Exceptions</h2>{exceptions?.map(item=><section key={item.id}><h3>{item.code} · {item.order_id}</h3><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(item.details,null,2)}</pre>{item.reviewed_at?<p>Reviewed: {item.review_note}</p>:<form action={review}><input type="hidden" name="exception_id" value={item.id}/><label>Review note<textarea name="note" required minLength={10} maxLength={2000}/></label><button type="submit">Save review note</button></form>}</section>)}
    <h2>Pending email notifications</h2>{notices?.map(n=><p key={n.id}>{n.order_id} · {n.event} · {n.status} · attempts {n.attempts} {n.last_error}</p>)}
  </main></OwnerOperationsShell>;
}
