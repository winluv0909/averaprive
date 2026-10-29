import Image from "next/image";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import QRCode from "qrcode";
import {requireAgencyRole} from "@/lib/auth/authorization";
import {createAdminClient} from "@/lib/supabase/admin";
import {AgencyWorkspaceShell} from "@/app/dashboard/_components/portal-shells";
import PaymentRefresh from "./PaymentRefresh";
import { CopyValue, PaymentExpiry } from "./PaymentControls";
import "./payment-premium.css";
async function submitHint(agencyId:string, orderId:string, formData:FormData) {
  "use server";
  const {supabase}=await requireAgencyRole(agencyId,["owner","admin","billing"]);
  const hash=String(formData.get("txid")||"").trim();
  const order=await createAdminClient().from("ap_payment_orders").select("id").eq("id",orderId).eq("agency_id",agencyId).eq("wallet_generation","trust_wallet_v1").single();
  if(order.error) notFound();
  const result=await supabase.rpc("ap_submit_trust_wallet_hint",{target_order:orderId,hash});
  redirect(`/agency/dashboard/agencies/${agencyId}/billing/payments/${orderId}?${result.error?"error=Unable%20to%20save%20transaction%20hint.%20Check%20the%20hash%20and%20try%20again.":"hint=1"}`);
}
const labels:Record<string,string>={awaiting_payment:"Awaiting payment",detected:"Payment detected",confirming:"Confirming",confirmed:"Payment confirmed",underpaid:"Underpayment — review required",overpaid:"Overpayment — review required",wrong_token:"Incorrect token — review required",wrong_network:"Incorrect network — review required",wrong_destination:"Incorrect destination — review required",duplicate_txid:"Duplicate transaction — review required",expired:"Invoice expired",late_payment:"Late payment — review required",failed_on_chain:"Transaction failed on chain",manual_review:"Manual review required",matching_review:"Payment matching — review required"};
export default async function PaymentPage({params,searchParams}:{params:Promise<{agencyId:string;orderId:string}>;searchParams:Promise<{error?:string;hint?:string}>}) {
  const {agencyId,orderId}=await params,query=await searchParams;
  const {user}=await requireAgencyRole(agencyId,["owner","admin","billing"]);
  const db=createAdminClient();
  const [{data:order},{data:invoice}]=await Promise.all([db.from("ap_payment_orders").select("*").eq("id",orderId).eq("agency_id",agencyId).single(),db.from("ap_invoices").select("id,invoice_number,payment_snapshot").eq("order_id",orderId).eq("agency_id",agencyId).maybeSingle()]);
  if(!order) notFound();
  const root=`/agency/dashboard/agencies/${agencyId}/billing`,url=`${root}/payments/${orderId}`;
  if(order.provider === "paypal") redirect(`${root}/paypal/${orderId}`);
  if(order.wallet_generation !== "trust_wallet_v1" && order.status !== "paid") return <AgencyWorkspaceShell email={user.email}><main className="reliable-billing"><h1>Archived crypto payment</h1><p>Crypto checkout is disabled. Do not send funds to this historical payment address. Contact billing support if you previously sent a payment.</p><Link href={root}>Use PayPal checkout</Link>{invoice && <p><Link href={`${root}/invoices/${invoice.id}`}>View historical invoice</Link></p>}</main></AgencyWorkspaceShell>;
  if(order.status==="cancelled" && invoice?.payment_snapshot?.refund_case_id) {
    const recorded=invoice.payment_snapshot.refund_status==="refund_recorded";
    return <AgencyWorkspaceShell email={user.email}><main className="ap-payment"><nav className="ap-payment-breadcrumb"><Link href={root}>← Billing</Link></nav><header className="ap-payment-header"><div><p className="ap-payment-eyebrow">AVERA PRIVÉ · AGENCY BILLING</p><h1>{recorded?"Refund transfer recorded":"Refund in progress"}</h1><p>Invoice {invoice.invoice_number} has been cancelled. Do not send another payment to this invoice.</p></div></header><section className="ap-payment-checkout"><h2>{recorded?"Check your receiving wallet":"Our team is arranging your refund"}</h2><p>This payment did not activate a subscription. Your invoice is void.</p>{recorded?<><p>Our team recorded an outgoing refund of {String(invoice.payment_snapshot.refund_amount)} {order.crypto_asset} on {order.crypto_network}. This is an owner-recorded transfer; confirm it has arrived in your wallet.</p><p style={{overflowWrap:"anywhere"}}>Refund TXID: {invoice.payment_snapshot.refund_txid}</p><p>After receiving the refund, return to billing to create a new invoice and follow its new payment instructions.</p></>:<p>Contact billing support to confirm your refund destination. Wait for the refund before creating another payment.</p>}<Link href={root}>Return to billing →</Link></section></main></AgencyWorkspaceShell>;
  }
  // Snapshot string preserves the exact quote; never round the token amount for display.
  const amount=String(invoice?.payment_snapshot?.expected_crypto_amount||order.expected_crypto_amount);
  const qr=await QRCode.toDataURL(String(order.receiving_address),{width:240,margin:2});
  const paid=order.status==="paid" && order.current_crypto_status==="confirmed";
  const state=order.current_crypto_status||"awaiting_payment";
  const progress=paid?3:state==="confirming"?2:state==="detected"?1:0;
  const network={ERC20:"Ethereum (ERC20)",BEP20:"BNB Smart Chain (BEP20)",TRC20:"Tron (TRC20)",ARBITRUM:"Arbitrum One",BASE:"Base",BITCOIN:"Bitcoin"}[String(order.crypto_network)]||order.crypto_network;
  const review=!["awaiting_payment","detected","confirming","confirmed"].includes(state);
  const confirmations=Number(order.blockchain_confirmations)||0;
  const required=Number(order.required_confirmations)||0;
  const completion=required>0?Math.min(100,Math.max(0,confirmations/required*100)):0;
  const steps=[{title:"Awaiting payment",note:"Send the exact amount below"},{title:"Payment detected",note:"Transaction located on the network"},{title:"Confirming",note:"Checking confirmations and finality"},{title:"Payment confirmed",note:"Payment verification complete"}];
  return <AgencyWorkspaceShell email={user.email}><main className="ap-payment">
    <nav className="ap-payment-breadcrumb" aria-label="Breadcrumb"><Link href={root}>← Billing</Link><span aria-hidden="true">/</span><Link href={`${root}/invoices`}>Invoices</Link><span aria-hidden="true">/</span><span>Crypto payment</span></nav>
    <header className="ap-payment-header"><div><p className="ap-payment-eyebrow">AVERA PRIVÉ · AGENCY BILLING</p><h1>{paid?"Payment complete":"Complete your payment"}</h1><p>A seamless next step for your agency.</p></div><div className="ap-payment-invoice"><span>INVOICE REFERENCE</span><strong>{invoice?.invoice_number||"Payment invoice"}</strong><span className="ap-payment-security">◇ Secure payment verification</span></div></header>
    {query.error&&<div className="ap-payment-notice ap-payment-notice--error" role="alert">{query.error}</div>}
    {query.hint&&<div className="ap-payment-notice" role="status">Transaction hint saved. This is not proof of payment; the backend will verify it independently.</div>}
    <div className="ap-payment-layout">
      <section className="ap-payment-checkout" aria-labelledby="payment-instructions"><div className="ap-payment-checkout-heading"><p className="ap-payment-eyebrow">PAYMENT REQUEST</p><span className="ap-payment-network">{network}</span></div>
        <h2 id="payment-instructions">{paid?"Verified payment details":"Send the exact amount"}</h2>
        <div className="ap-payment-amount"><strong>{amount}</strong><span>{order.crypto_asset==="BTC"&&order.wallet_generation!=="trust_wallet_v1"?"wrapped BTC":order.crypto_asset}</span></div>
        <div className="ap-payment-amount-footer"><span>Invoice total · USD {Number(order.total_amount).toFixed(2)}</span><CopyValue value={amount} label="Copy amount" /></div>
        <div className="ap-payment-scan"><div className="ap-payment-qr"><Image src={qr} alt="Receiving wallet address QR code" width={240} height={240} unoptimized /></div><div><span className="ap-payment-step-label">01 / SCAN & SEND</span><h3>{paid?"Receiving wallet":"Scan with your wallet"}</h3><p>QR contains the address only. Select <strong>{order.crypto_asset}</strong> on <strong>{network}</strong> and enter the exact amount above.</p></div></div>
        <div className="ap-payment-address"><div><label htmlFor="ap-receiving-address">RECEIVING ADDRESS</label><CopyValue value={String(order.receiving_address)} label="Copy address" /></div><input id="ap-receiving-address" readOnly value={String(order.receiving_address)} aria-label="Receiving address" /></div>
        <div className="ap-payment-instruction">Use only <strong>{order.crypto_asset}</strong> on <strong>{network}</strong>. Sender fees are additional; the receiving amount must match this invoice.</div>
        {(state==="expired"||paid)&&<div className="ap-payment-notice">{paid?"Payment is confirmed. Do not send another payment to this invoice.":"This invoice has expired. Do not send a new payment; late payments require review."}</div>}
        {(order.crypto_network==="ARBITRUM"||order.crypto_network==="BASE")&&<div className="ap-payment-notice">Use native USDC at the contract below. USDC.e and other bridged versions are not accepted.</div>}
        <details className="ap-payment-details"><summary>Payment & verification details<span aria-hidden="true">＋</span></summary><dl><dt>Token contract / mint</dt><dd>{order.token_contract||"Legacy configuration"}</dd><dt>Matching adjustment</dt><dd>{String(invoice?.payment_snapshot?.matching_adjustment||"0")} {order.crypto_asset} · included in the exact amount</dd><dt>Payment ID</dt><dd>{orderId}</dd><dt>Invoice ID</dt><dd>{invoice?.id||"Unavailable"}</dd><dt>Verified transaction</dt><dd>{order.verified_transaction_hash||"Not yet verified"}</dd></dl><p>Underpayment, overpayment, late payment and incorrect tokens require review.</p>{order.receiving_mode==="shared"&&<p>This receiving address supports simultaneous payments. Each invoice has a distinct exact amount. Incorrect or ambiguous deposits require review; entering a TXID cannot claim a payment.</p>}{order.receiving_provider==="binance"&&<p>Receiving provider: Binance. Payment must also be credited to the configured Binance account before activation.</p>}</details>
      </section>
      <aside className="ap-payment-sidebar"><section className="ap-payment-summary"><p className="ap-payment-eyebrow">YOUR SUBSCRIPTION</p><div className="ap-payment-plan"><h2>{order.plan_code}</h2><span>{order.billing_cycle}</span></div><div className="ap-payment-summary-total"><span>Invoice total</span><strong>USD {Number(order.total_amount).toFixed(2)}</strong></div><PaymentExpiry expiresAt={String(order.payment_expires_at||"")} paid={paid}/></section>
        <section className="ap-payment-status" aria-labelledby="payment-status"><div className="ap-payment-status-top"><p className="ap-payment-eyebrow">PAYMENT STATUS</p><span className="ap-payment-status-dot" data-paid={paid} data-review={review} /></div><h2 id="payment-status">{labels[state]||state}</h2>
          <ol className="ap-payment-progress">{steps.map((step,i)=><li key={step.title} data-complete={!review&&i<progress} data-active={!review&&i===progress} aria-current={!review&&i===progress?"step":undefined}><span className="ap-payment-progress-number" aria-hidden="true">{!review&&i<progress?"✓":i+1}</span><div><strong>{step.title}</strong><small>{step.note}</small></div></li>)}</ol>
          <div className="ap-payment-confirmations"><div><span>Network confirmations</span><strong>{confirmations} / {required}</strong></div><div className="ap-payment-meter" role="progressbar" aria-label="Network confirmations" aria-valuemin={0} aria-valuemax={required||1} aria-valuenow={Math.min(confirmations,required||1)}><span style={{width:`${completion}%`}} /></div><p>{order.crypto_network==="BITCOIN"?"Bitcoin requires six confirmations. Unconfirmed transactions do not activate subscriptions.":"Network finalized status is also required. Broadcast transactions do not activate subscriptions."}</p></div>
          <div className="ap-payment-monitor"><PaymentRefresh url={`${url}/status`} paid={paid}/><p><span>Last checked</span><strong>{order.last_monitored_at?new Date(order.last_monitored_at).toLocaleString("en-US",{timeZone:"UTC"})+" UTC":"Waiting for the payment monitor"}</strong></p></div>
          {order.monitor_error&&<div className="ap-payment-notice ap-payment-notice--error" role="alert">Verification is temporarily unavailable. Payment remains unconfirmed; support has been notified.</div>}
          {!order.token_contract&&<div className="ap-payment-notice ap-payment-notice--error" role="alert">This legacy invoice does not support automatic verification. Contact billing support before paying.</div>}
          {state==="matching_review"&&<div className="ap-payment-notice" role="status">A deposit needs invoice matching. Contact billing support with your payer records. Do not send another payment while it is being reviewed.</div>}
          {paid&&invoice&&<Link className="ap-payment-button" href={`${root}/invoices/${invoice.id}`}>View paid invoice →</Link>}
        </section></aside>
    </div>
    {!paid&&<details className="ap-payment-help" open={query.hint?true:undefined}><summary><span><strong>Already sent your payment?</strong><small>Add a transaction hash for billing support. Automatic detection needs no TXID.</small></span><span aria-hidden="true">＋</span></summary><div><p>This hint helps locate a deposit; it does not confirm or claim a payment. If several invoices match, billing support must verify which agency paid.</p><form action={submitHint.bind(null,agencyId,orderId)}><label htmlFor="ap-txid">TXID / transaction hash</label><div className="ap-payment-hint-row"><input id="ap-txid" name="txid" maxLength={100} defaultValue={order.submitted_txid||""} placeholder="Paste your transaction hash" required/><button className="ap-payment-button" type="submit">Save transaction hint</button></div></form></div></details>}
    <footer className="ap-payment-footer"><span>AVERA PRIVÉ</span><p>Agency billing · Verified on-chain</p><Link href={root}>Return to billing →</Link></footer>
  </main></AgencyWorkspaceShell>;
}
