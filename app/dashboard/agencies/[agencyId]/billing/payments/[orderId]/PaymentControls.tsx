"use client";

import { useEffect, useState } from "react";

export function CopyValue({ value, label }: { value: string; label: string }) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied");
    } catch {
      setMessage("Select and copy manually");
    }
  }
  return <span className="ap-payment-copy-wrap"><button type="button" className="ap-payment-copy" onClick={copy} aria-label={label}>▣ {label}</button><span className="ap-payment-copy-feedback" role="status">{message}</span></span>;
}

export function PaymentExpiry({ expiresAt, paid }: { expiresAt: string; paid: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (paid) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [paid]);
  const end = new Date(expiresAt).getTime();
  const valid = Number.isFinite(end);
  const seconds = valid && now !== null ? Math.max(0, Math.ceil((end - now) / 1000)) : null;
  const countdown = seconds === null ? "—" : seconds === 0 ? "Time elapsed" : `${String(Math.floor(seconds / 3600)).padStart(2,"0")}:${String(Math.floor(seconds % 3600 / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;
  return <div className="ap-payment-expiry" data-expired={!paid && seconds === 0}><span>{paid ? "PAYMENT VERIFIED" : "PAYMENT WINDOW"}</span><strong>{paid ? "Complete" : countdown}</strong>{!paid && <small>{valid ? <><time dateTime={expiresAt}>{new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(new Date(expiresAt))}</time> UTC</> : "Expiry unavailable"}</small>}{!paid && seconds === 0 && <p>Do not send a new payment. Late payments require review.</p>}</div>;
}
