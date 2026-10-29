/** Display rules shared by the invoice page, receipt text and PDF. */
export function invoiceState(status:string,payment:Record<string,unknown>,now=Date.now()) {
  const voided=status==="void";
  const refund=voided&&Boolean(payment.refund_case_id);
  const recorded=refund&&payment.refund_status==="refund_recorded";
  const expiry=payment.expires_at?Date.parse(String(payment.expires_at)):NaN;
  const expired=status==="overdue" || (Number.isFinite(expiry)&&expiry<=now);
  const stopped=voided || expired || Boolean(payment.refund_case_id);
  const label=refund?(recorded?"Refund transfer recorded":"Refund in progress"):voided?"Invoice void - do not pay":expired?"Invoice expired - do not pay":status==="paid"?"Payment confirmed":"Payment is not yet confirmed";
  const note=refund?(recorded?"Owner-recorded refund. Confirm receipt before creating a new invoice.":"Wait for billing support to arrange your refund. Do not pay this invoice."):stopped?"Do not send funds to this invoice. Contact billing support.":status==="paid"?"Do not send another payment to this invoice.":"Subscription activates only after payment verification.";
  const canShowPaymentQr=!stopped&&status==="open"&&payment.wallet_generation==="trust_wallet_v1"&&payment.provider!=="paypal"&&["awaiting_payment",undefined].includes(payment.status as string|undefined);
  return {voided,refund,recorded,expired,stopped,label,note,canShowPaymentQr};
}
