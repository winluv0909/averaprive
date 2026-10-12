"use client";
import { useState } from "react";
export function PaymentMethodSelector({ ready, environment, channels }: { ready: boolean; environment: string; channels: Array<{key: string; label: string; ready: boolean}> }) {
  const cryptoReady = channels.some(channel => channel.ready);
  const [provider, setProvider] = useState(ready ? "paypal" : "crypto");
  return <div className="premium-payment-selection">
    <fieldset className="premium-payment-methods"><legend className="sr-only">Payment method</legend>
      <label className="premium-payment-method"><input type="radio" name="provider" value="paypal" checked={provider === "paypal"} disabled={!ready} onChange={() => setProvider("paypal")} />
        <span className="premium-payment-icon" aria-hidden="true">P</span><b>PayPal</b><small>{environment === "sandbox" ? "Sandbox · test payments" : "Secure checkout"}</small></label>
      <label className="premium-payment-method"><input type="radio" name="provider" value="crypto" checked={provider === "crypto"} disabled={!cryptoReady} onChange={() => setProvider("crypto")} />
        <span className="premium-payment-icon" aria-hidden="true">◇</span><b>Cryptocurrency</b><small>USDT · USDC · Bitcoin</small></label>
    </fieldset>
    {provider === "crypto" ? <><label>Coin and network<select name="crypto_channel" required disabled={!cryptoReady} defaultValue={channels.find(c => c.ready)?.key || ""}>
      {!cryptoReady && <option value="">Crypto is not configured yet</option>}
      {channels.map(channel => <option key={channel.key} value={channel.key} disabled={!channel.ready}>{channel.label}{channel.ready ? "" : " — unavailable"}</option>)}
    </select></label><p>Real crypto payments are sent directly to our Trust Wallet receiving address. Your invoice will show the exact amount, token contract, network, QR code and expiry.</p>
    <p>A small matching adjustment is included in the exact crypto amount: at most 0.009999 USDT/USDC or 0.00000999 BTC. This distinguishes simultaneous invoices. Check the complete amount before sending.</p></> : <>
      {!ready && <p role="alert">PayPal is not configured yet.</p>}
      <p>{environment === "sandbox" ? "PayPal test mode: use your sandbox buyer account. No real money is charged and your real plan will not change." : "Approve payment securely on PayPal. Available funding methods are shown by PayPal."}</p></>}
    <p>One-time payment for one month or one year of access. No automatic renewal.</p>
    <button className="premium-pay-button" type="submit" disabled={provider === "paypal" ? !ready : !cryptoReady}>
      {provider === "crypto" ? "Generate crypto payment invoice" : `Continue to PayPal${environment === "sandbox" ? " Sandbox" : ""}`}
    </button>
  </div>;
}
