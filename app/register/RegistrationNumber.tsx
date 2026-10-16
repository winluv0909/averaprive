"use client";

import { useRef, useState } from "react";
import { requestAgencyRegistrationNumber, confirmAgencyRegistrationNumber } from "./registration-number-actions";

type Props = {
  email: string;
  emailVerified: boolean;
  onVerified: (number: string) => void;
};
export default function RegistrationNumber({ email, emailVerified, onVerified }: Props) {
  const [number, setNumber] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [verifiedFor, setVerifiedFor] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const ownerEmail = email.trim().toLowerCase();
  const sent = Boolean(ownerEmail) && sentTo === ownerEmail;
  const verified = Boolean(ownerEmail) && verifiedFor === ownerEmail;

  async function sendNumber() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    const requestedEmail = ownerEmail;
    // A new delivery invalidates the previous confirmation on the server.
    setVerifiedFor("");
    onVerified("");
    try {
      const result = await requestAgencyRegistrationNumber(requestedEmail);
      setMessage(result.message);
      if (result.ok) {
        setSentTo(requestedEmail);
        setNumber("");
      }
    } catch { setMessage("The request could not finish. Please retry."); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function verifyNumber() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    const requestedEmail = ownerEmail;
    try {
      const result = await confirmAgencyRegistrationNumber(requestedEmail, number);
      setMessage(result.message);
      if (result.ok && result.registrationNumber) {
        setNumber(result.registrationNumber);
        setVerifiedFor(requestedEmail);
        onVerified(result.registrationNumber);
      }
    } catch { setMessage("Verification could not finish. Please retry."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return (
    <div className="registration-number-card" aria-busy={busy}>
      <label htmlFor="agency-registration-number">
        <span>AVERA PRIVÉ REGISTRATION NUMBER</span>
      </label>
      <p className="registration-number-description">
        Avera Privé generates your unique platform registration number and emails it to your verified owner email.
      </p>
      <div className="registration-number-controls">
        <input
          id="agency-registration-number"
          name="registrationNumber"
          type="text"
          value={sent || verified ? number : ""}
          onChange={(event) => {
            setNumber(event.target.value.toUpperCase().replace(/\s/g, ""));
            setVerifiedFor("");
            onVerified("");
          }}
          maxLength={28}
          placeholder="Enter the number from your email"
          autoComplete="off"
          spellCheck={false}
          readOnly={verified}
          disabled={busy || (!sent && !verified)}
          required
          aria-describedby="agency-registration-number-help"
          data-number-verified={verified ? "true" : "false"}
        />
        <button
          type="button"
          disabled={busy || verified || !emailVerified || (sent && !/^AP-[0-9]{4}-[0-9A-F]{20}$/.test(number))}
          onClick={sent ? verifyNumber : sendNumber}
        >
          {busy ? "Please wait…" : verified ? "✓ Number verified" : sent ? "Verify Registration Number" : "Get Registration Number"}
        </button>
      </div>
      <p id="agency-registration-number-help" className="registration-number-description">
        {!emailVerified ? "Verify your owner email above to enable this button. " : ""}
        Enter it within 15 minutes in this browser. This identifies your registration with Avera Privé; it does not grant a verification badge.
      </p>
      {sent && <button className="registration-number-resend" type="button" disabled={busy || !emailVerified} onClick={sendNumber}>Resend the same number</button>}
      {message && <p className="registration-number-status" role="status">{message}</p>}
    </div>
  );
}
