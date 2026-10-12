"use client";
import { useEffect, useRef } from "react";
import { confirmPayPalPayment } from "./actions";
export default function AutoConfirm({ agencyId, orderId }: { agencyId: string; orderId: string }) {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void confirmPayPalPayment(agencyId, orderId);
  }, [agencyId, orderId]);
  return <p role="status">Checking your payment securely with PayPal…</p>;
}
