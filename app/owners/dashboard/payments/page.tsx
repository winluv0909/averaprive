import {walletOptions} from "@/lib/billing/wallet/config";
import Link from "next/link";
import {redirect} from "next/navigation";
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
async function openRefund(form:FormData) {
  "use server";
  const {supabase}=await requireStaffRole(["super_admin"]);
  if(form.get("ownership_confirmed")!=="on") redirect("/owners/dashboard/payments?refund=error");
  const {error}=await supabase.rpc("ap_open_crypto_refund",{target_exception:String(form.get("exception_id")||""),owner_note:String(form.get("note")||"")});
  revalidatePath("/owners/dashboard/payments");
  revalidatePath("/agency/dashboard", "layout");
  redirect(`/owners/dashboard/payments?refund=${error?"error":"opened"}`);
}
async function recordRefund(form:FormData) {
  "use server";
  const {supabase}=await requireStaffRole(["super_admin"]);
  if(form.get("sent_confirmed")!=="on") redirect("/owners/dashboard/payments?refund=error");
  const {error}=await supabase.rpc("ap_record_crypto_refund",{target_case:String(form.get("case_id")||""),transaction_hash:String(form.get("txid")||""),amount:String(form.get("amount")||""),destination:String(form.get("destination")||""),owner_note:String(form.get("note")||"")});
  revalidatePath("/owners/dashboard/payments");
  revalidatePath("/agency/dashboard", "layout");
  redirect(`/owners/dashboard/payments?refund=${error?"error":"recorded"}`);
}
export default async function PaymentsPage({searchParams}: {searchParams?:Promise<{refund?:string}>} = {}) {
  const query=await searchParams;

  const channels=walletOptions(), readyChannels=channels.filter(channel=>channel.ready);
  const {user,role}=await requireStaffRole(["super_admin","finance"]),db=createAdminClient();
  const [{data:orders,error},{data:exceptions},{data:deposits,error:depositError},{data:refunds,error:refundError},{data:notices}]=await Promise.all([
    db.from("ap_payment_orders").select("*").in("provider",["crypto","paypal"]).order("created_at",{ascending:false}).limit(100),
    db.from("ap_payment_exceptions").select("*").order("created_at",{ascending:false}).limit(100),
    db.from("ap_shared_crypto_deposits").select("*").in("matching_state",["unmatched","ambiguous"]).order("updated_at",{ascending:false}).limit(100),
    db.from("ap_crypto_refund_cases").select("*").order("opened_at",{ascending:false}).limit(100),
    db.from("ap_payment_notifications").select("id,order_id,event,status,last_error,attempts").neq("status","sent").limit(100),
  ]);
  if(error || depositError || refundError) throw new Error("Payment records unavailable. Apply the payment database updates, including Step 08, first.");
  const openDeposits=deposits?.filter(deposit=>!refunds?.some(item=>item.network===deposit.network&&item.deposit_txid===deposit.txid));
  return <OwnerOperationsShell active="subscriptions" email={user.email}><main className="owner-main"><h1>Payment review</h1><p>Live PayPal plans activate only after a verified completed capture. Sandbox payments do not change live access. Review notes do not approve a payment.</p><Link href="/owners/dashboard/subscriptions">Back to subscriptions</Link>
    {query?.refund==="error"&&<p role="alert">Refund record was not saved. Check owner access, finalized deposit evidence, payer ownership, invoice status and the full refund amount. A deposit linked to another invoice cannot be used.</p>}
    {query?.refund==="opened"&&<p role="status">Refund case opened. The old invoice is cancelled and void. Arrange the refund outside the website.</p>}
    {query?.refund==="recorded"&&<p role="status">Outgoing refund details recorded. Confirm receipt with the customer before asking them to create a new invoice.</p>}
    <h2>Refund and retry</h2><p>Underpayments, overpayments and late payments are refunded instead of accepted. Only an owner can open a case after checking payer ownership and finalized deposit evidence. Opening a case cancels the unpaid order and voids its invoice. No subscription is activated.</p>
    <p>Refund the full received amount from your wallet; pay network fees separately. Verify the refund destination with the payer through your established support channel. This website records your outgoing transfer details; it does not send or independently verify refunds.</p>
    {!refunds?.length&&<p>No refund cases.</p>}
    {refunds?.map(item=><section key={item.id} style={{border:"1px solid #d8d2c4",padding:"1.25rem",marginBlock:"1rem"}}><h3>{item.state==="refund_recorded"?"Refund recorded":"Refund required"} · {item.asset} / {item.network}</h3><p>Payment ID: {item.order_id}</p><p>Full deposit: {String(item.evidence.amount)} {item.asset}</p><p style={{overflowWrap:"anywhere"}}>Incoming TXID: {item.deposit_txid}</p><p>Ownership evidence: {item.ownership_note}</p>{item.state==="refund_recorded"?<><p style={{overflowWrap:"anywhere"}}>Outgoing TXID: {item.refund_txid}</p><p style={{overflowWrap:"anywhere"}}>Refund destination: {item.refund_destination}</p><p>{item.refund_note}</p><p>Owner-recorded transfer. Confirm receipt with the customer, then ask them to create a new invoice.</p></>:role==="super_admin"?<form action={recordRefund}><input type="hidden" name="case_id" value={item.id}/><p><label>Outgoing refund TXID<input name="txid" required maxLength={66}/></label></p><p><label>Full refund amount ({item.asset})<input name="amount" required defaultValue={String(item.evidence.amount)} inputMode="decimal" maxLength={80}/></label></p><p><label>Verified payer refund destination<input name="destination" required minLength={10} maxLength={200}/></label></p><p><label>Refund and customer contact note<textarea name="note" required minLength={20} maxLength={2000}/></label></p><p><label><input type="checkbox" name="sent_confirmed" required/> I sent this refund from the wallet and checked the amount, token, network and destination.</label></p><button type="submit">Record outgoing refund</button></form>:<p>An owner must arrange and record this refund.</p>}</section>)}
    <h2>Crypto checkout status</h2><p>{readyChannels.length ? `Crypto checkout is configured for ${readyChannels.length} payment channels. Configuration readiness does not confirm that the scheduled monitor is running.` : "Crypto checkout is unavailable. No payment channel currently passes the checkout configuration checks."}</p><ul>{channels.map(channel=><li key={channel.key}>{channel.label} · {channel.ready ? "Configured" : "Unavailable"}</li>)}</ul><p>Exact wallet payments are matched automatically after server verification. A submitted transaction hash or a review note cannot activate a plan. Confirm the scheduled crypto monitor is running before accepting payments.</p>
    <h2>Deposits requiring support review</h2><p>Check independent payer evidence and the linked invoice. Incorrect amounts, tokens, networks and late payments require support review. Manual invoice assignment is unavailable for the current wallet system.</p>
    {!openDeposits?.length&&<p>No deposits currently need matching.</p>}
    {openDeposits?.map(deposit=><section key={`${deposit.network}:${deposit.txid}:${deposit.token}:${deposit.destination}`}><h3>{deposit.matching_state} · {deposit.network} · {deposit.evidence?.amount}</h3><p style={{overflowWrap:"anywhere"}}>TXID: {deposit.txid}</p><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(deposit.evidence,null,2)}</pre><p style={{overflowWrap:"anywhere"}}>Candidate payment IDs: {Array.isArray(deposit.candidate_ids)?deposit.candidate_ids.join(", "):"None"}</p><p>Use the payment exceptions below to record your review. A review note does not settle the invoice or grant subscription access.</p></section>)}
    <h2>Payment records</h2>{orders?.map(order=><details key={order.id}><summary>{order.provider_reference||order.id} · {order.provider === "paypal" ? `${order.paypal_environment} / ${order.paypal_state}` : `${order.wallet_generation === "trust_wallet_v1" ? "Wallet crypto" : "Archived crypto"} / ${order.current_crypto_status}`} · {order.payer_company_name}</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(order,null,2)}</pre></details>)}
    <h2>Exceptions</h2>{exceptions?.map(item=><section key={item.id}><h3>{item.code} · {item.order_id}</h3><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(item.details,null,2)}</pre>{["underpaid","overpaid","late_payment"].includes(item.code)&&role==="super_admin"&&!refunds?.some(r=>r.order_id===item.order_id)&&orders?.some(o=>o.id===item.order_id&&o.wallet_generation==="trust_wallet_v1"&&o.status==="pending")&&<details><summary>Open refund-and-retry case</summary><p>Check independent payer records first. This cancels the old invoice and stops payment activation. Only finalized deposits on the configured token and network qualify.</p><form action={openRefund}><input type="hidden" name="exception_id" value={item.id}/><p><label>Payer ownership and support evidence<textarea name="note" required minLength={20} maxLength={2000}/></label></p><p><label><input type="checkbox" name="ownership_confirmed" required/> I checked that this deposit belongs to this payer and agreed the refund through support.</label></p><button type="submit">Cancel invoice and open refund case</button></form></details>}{item.reviewed_at?<p>Reviewed: {item.review_note}</p>:<form action={review}><input type="hidden" name="exception_id" value={item.id}/><label>Review note<textarea name="note" required minLength={10} maxLength={2000}/></label><button type="submit">Save review note</button></form>}</section>)}
    <h2>Pending email notifications</h2>{notices?.map(n=><p key={n.id}>{n.order_id} · {n.event} · {n.status} · attempts {n.attempts} {n.last_error}</p>)}
  </main></OwnerOperationsShell>;
}
