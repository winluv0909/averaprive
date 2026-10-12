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
async function assignDeposit(form:FormData) {
  "use server";
  await requireStaffRole(["super_admin","finance"]);
  // Retain the archived form shape, but reject new crypto assignments.
  if(form) throw new Error("Crypto processing is disabled. Use PayPal checkout.");
}
export default async function PaymentsPage() {
  const {user}=await requireStaffRole(["super_admin","finance"]),db=createAdminClient();
  const [{data:orders,error},{data:exceptions},{data:deposits,error:depositError},{data:notices}]=await Promise.all([
    db.from("ap_payment_orders").select("*").in("provider",["crypto","paypal"]).order("created_at",{ascending:false}).limit(100),
    db.from("ap_payment_exceptions").select("*").order("created_at",{ascending:false}).limit(100),
    db.from("ap_shared_crypto_deposits").select("*").in("matching_state",["unmatched","ambiguous"]).order("updated_at",{ascending:false}).limit(100),
    db.from("ap_payment_notifications").select("id,order_id,event,status,last_error,attempts").neq("status","sent").limit(100),
  ]);
  if(error || depositError) throw new Error("Payment records unavailable. Apply the shared checkout database migration first.");
  return <OwnerOperationsShell active="subscriptions" email={user.email}><main className="owner-main"><h1>Payment review</h1><p>Live PayPal plans activate only after a verified completed capture. Sandbox payments do not change live access. Review notes do not approve a payment.</p><Link href="/owners/dashboard/subscriptions">Back to subscriptions</Link>
    <h2>Deposits needing invoice matching</h2><p>Check the agency’s payer evidence before selecting an invoice. A copied transaction hash alone does not establish who paid. Crypto processing is disabled. These historical deposits are retained for billing support review.</p>
    {!deposits?.length&&<p>No deposits currently need matching.</p>}
    {deposits?.map(deposit=><section key={`${deposit.network}:${deposit.txid}:${deposit.token}:${deposit.destination}`}><h3>{deposit.matching_state} · {deposit.network} · {deposit.evidence?.amount}</h3><p style={{overflowWrap:"anywhere"}}>TXID: {deposit.txid}</p><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(deposit.evidence,null,2)}</pre><form action={assignDeposit}><input type="hidden" name="network" value={deposit.network}/><input type="hidden" name="txid" value={deposit.txid}/><p style={{overflowWrap:"anywhere"}}>Candidate payment IDs: {Array.isArray(deposit.candidate_ids)?deposit.candidate_ids.join(", "):"None"}</p><label>Invoice payment ID<input name="order_id" required list={`candidate-${deposit.network}-${deposit.txid}`} placeholder="Select a candidate or paste its payment ID" pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"/><datalist id={`candidate-${deposit.network}-${deposit.txid}`}>{orders?.filter(order=>order.status==="pending" && Array.isArray(deposit.candidate_ids) && deposit.candidate_ids.includes(order.id) && order.token_contract===deposit.token && order.receiving_address===deposit.destination).map(order=><option key={order.id} value={order.id}>{order.provider_reference||order.id} · {order.payer_company_name} · {order.expected_crypto_amount} {order.crypto_asset}</option>)}</datalist></label><label>Payer evidence checked<textarea name="note" required minLength={20} maxLength={2000} placeholder="Record the independent payer evidence and agency identity you checked."/></label><button type="submit" disabled>Crypto processing disabled</button></form></section>)}
    <h2>Payment records</h2>{orders?.map(order=><details key={order.id}><summary>{order.provider_reference||order.id} · {order.provider === "paypal" ? `${order.paypal_environment} / ${order.paypal_state}` : `Archived crypto / ${order.current_crypto_status}`} · {order.payer_company_name}</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(order,null,2)}</pre></details>)}
    <h2>Exceptions</h2>{exceptions?.map(item=><section key={item.id}><h3>{item.code} · {item.order_id}</h3><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(item.details,null,2)}</pre>{item.reviewed_at?<p>Reviewed: {item.review_note}</p>:<form action={review}><input type="hidden" name="exception_id" value={item.id}/><label>Review note<textarea name="note" required minLength={10} maxLength={2000}/></label><button type="submit">Save review note</button></form>}</section>)}
    <h2>Pending email notifications</h2>{notices?.map(n=><p key={n.id}>{n.order_id} · {n.event} · {n.status} · attempts {n.attempts} {n.last_error}</p>)}
  </main></OwnerOperationsShell>;
}
