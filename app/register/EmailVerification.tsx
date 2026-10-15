"use client";

import { useRef, useState } from "react";
import {
  requestRegistrationCode,
  confirmRegistrationCode,
} from "./email-actions";

type Props = {
  email: string;
  onVerified: (email: string) => void;
};

export default function EmailVerification({ email, onVerified }: Props) {
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const normalizedEmail = email.trim().toLowerCase();
  const sent = Boolean(normalizedEmail) && sentTo === normalizedEmail;
  const verified =
    Boolean(normalizedEmail) && verifiedEmail === normalizedEmail;

  async function sendCode() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");

    const requestedEmail = normalizedEmail;

    try {
      const result = await requestRegistrationCode(requestedEmail);
      setMessage(result.message);

      if (result.ok) {
        setSentTo(requestedEmail);
        setVerifiedEmail("");
        setCode("");
        onVerified("");
      }
    } catch {
      setMessage("The request could not finish. Please retry.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");

    const requestedEmail = normalizedEmail;

    try {
      const result = await confirmRegistrationCode(requestedEmail, code);
      setMessage(result.message);

      if (result.ok) {
        setVerifiedEmail(requestedEmail);
        onVerified(requestedEmail);
      }
    } catch {
      setMessage("Verification could not finish. Please retry.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="registration-email-check" aria-busy={busy}>
      <p>
        <strong>Verify your owner email</strong>
      </p>

      <p>
        We will email an eight-digit code to{" "}
        <strong>{normalizedEmail || "the owner email entered in Step 01"}</strong>.
        This confirms email ownership only.
      </p>

      {!verified && (
        <label>
          <span>AVERA PRIVÉ VERIFICATION CODE</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 8))
            }
            disabled={busy || !sent}
            placeholder="Eight-digit code"
            aria-describedby="registration-code-help"
          />
        </label>
      )}

      <p id="registration-code-help">
        Codes expire after 15 minutes and allow five incorrect attempts.
        Use the same browser to request and verify your code.
        This is separate from an official business registration number.
      </p>

      <div className="registration-code-actions">
        <button
          type="button"
          disabled={
            busy ||
            verified ||
            !normalizedEmail ||
            (sent && code.length !== 8)
          }
          onClick={sent ? verifyCode : sendCode}
        >
          {busy
            ? "Please wait…"
            : verified
              ? "Email verified"
              : sent
                ? "Verify verification code"
                : "Get verification code"}
        </button>

        {sent && !verified && (
          <button type="button" disabled={busy} onClick={sendCode}>
            Resend code
          </button>
        )}
      </div>

      {message && <p role="status">{message}</p>}
    </div>
  );
}