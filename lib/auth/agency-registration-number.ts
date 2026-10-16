import "server-only";

import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireVerifiedRegistrationEmail } from "./registration-email";

const cookieName = "ap-agency-registration-number";
const numberPattern = /^AP-[0-9]{4}-[0-9A-F]{20}$/;
type Proof = { id: string; secret: string; email: string };
export type RegistrationNumberResult = { ok: boolean; message: string; registrationNumber?: string };
type Result = RegistrationNumberResult;

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invalid owner email.");
  }
  return email;
}
function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function keyedDigest(value: string) {
  const key = process.env.REGISTRATION_EMAIL_SECRET;
  if (!key || key.length < 32) throw new Error("Registration email is not configured.");
  return createHmac("sha256", key).update(value).digest("hex");
}
async function readProof(email: string): Promise<Proof | null> {
  const value = (await cookies()).get(cookieName)?.value;
  if (!value) return null;
  try {
    const proof = JSON.parse(value) as Proof;
    return typeof proof.id === "string" && /^[0-9a-f-]{36}$/i.test(proof.id)
      && typeof proof.secret === "string" && /^[0-9a-f]{64}$/.test(proof.secret)
      && proof.email === email ? proof : null;
  } catch { return null; }
}
function requestError(message: string) {
  if (message.includes("COOLDOWN")) return "A recent sending attempt is still within the 60-second cooldown. Please wait before retrying.";
  if (message.includes("RATE_LIMIT")) return "Too many registration-number requests. Please try again later.";
  if (message.includes("ALREADY_USED")) return "This registration number is already assigned to an agency. Sign in to your workspace.";
  return "The registration number could not be prepared. Please retry or contact support.";
}

export async function sendAgencyRegistrationNumber(rawEmail: string): Promise<Result> {
  let email: string;
  try {
    email = normalizeEmail(rawEmail);
    await requireVerifiedRegistrationEmail(email);
  } catch {
    return { ok: false, message: "Verify your owner email above before requesting a registration number. If that verification expired, request a fresh email code." };
  }
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.REGISTRATION_EMAIL_FROM || process.env.PAYMENT_EMAIL_FROM;
    if (!apiKey || !from) return { ok: false, message: "Registration email is not configured. Please contact support." };
    const requestHeaders = await headers();
    // Use host-provided addresses only. Do not combine unrelated visitors under a fallback hash.
    const address = requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
      || requestHeaders.get("x-real-ip")?.trim();
    if (!address || !isIP(address)) {
      return { ok: false, message: "The request could not be validated. Please contact support." };
    }
    const proof = await readProof(email) ?? {
      id: randomUUID(), secret: randomBytes(32).toString("hex"), email,
    };
    const deliveryId = randomUUID();
    const db = createAdminClient();
    const prepared = await db.rpc("ap_prepare_registration_number", {
      delivery_id: deliveryId, reservation_id: proof.id, target_email: email,
      target_visitor_hash: keyedDigest(`agency-number-visitor:${address}`),
      target_proof_hash: digest(proof.secret),
      proposed_number: `AP-${new Date().getUTCFullYear()}-${randomBytes(10).toString("hex").toUpperCase()}`,
    });
    if (prepared.error || typeof prepared.data !== "string") {
      return { ok: false, message: requestError(prepared.error?.message || "") };
    }
    const number = prepared.data;
    if (!numberPattern.test(number)) throw new Error("Unexpected registration-number format.");
    // Retain the proof even if sending fails, so retries reuse the same number.
    (await cookies()).set(cookieName, JSON.stringify(proof), {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60,
    });
    let accepted = false;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", redirect: "error",
        headers: {
          Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json",
          "Idempotency-Key": `agency-registration-${deliveryId}`,
        },
        body: JSON.stringify({
          from, to: [email], subject: "Your Avera Privé registration number",
          text: [
            `Your Avera Privé registration number is: ${number}`, "",
            "Enter this number on the registration page in the same browser, then click Verify Registration Number.",
            "Complete this verification within 15 minutes. This number will stay with the agency after registration is completed.",
            "This is an Avera Privé platform identifier. It is not a government business registration number, approval, or verification badge.",
            "If you did not request this number, you can ignore this email.",
          ].join("\n"),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      accepted = response.ok;
      if (!accepted) console.error("Registration-number email rejected", { status: response.status });
    } catch {
      console.error("Registration-number email request did not complete");
    }
    const status = accepted ? "sent" : "failed";
    const delivery = await db.from("ap_registration_number_deliveries")
      .update({ delivery_status: status }).eq("id", deliveryId).select("id").single();
    const saved = await db.from("ap_agency_registration_numbers").update({
      delivery_status: status,
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    }).eq("id", proof.id).eq("last_delivery_id", deliveryId).select("id").single();
    if (delivery.error || saved.error || !saved.data) {
      return { ok: false, message: "The sending result could not be saved. Wait 60 seconds and retry to receive the same number." };
    }
    if (!accepted) return { ok: false, message: "The email service did not confirm sending your number. Please wait 60 seconds and retry. Contact support if it continues." };
    return { ok: true, message: "Registration number sent. Check your inbox and spam folder." };
  } catch {
    return { ok: false, message: "The request could not finish. Please retry or contact support." };
  }
}

export async function verifyAgencyRegistrationNumber(rawEmail: string, rawNumber: string): Promise<Result> {
  try {
    const email = normalizeEmail(rawEmail);
    const proof = await readProof(email);
    const number = rawNumber.trim().toUpperCase();
    if (!proof || !numberPattern.test(number)) return { ok: false, message: "Enter the registration number emailed to you in this browser." };
    const result = await createAdminClient().rpc("ap_verify_registration_number", {
      reservation_id: proof.id, target_email: email,
      target_proof_hash: digest(proof.secret), supplied_number: number,
    });
    if (result.error) return { ok: false, message: "Registration-number verification is temporarily unavailable." };
    if (result.data === "verified") return { ok: true, message: "Avera Privé registration number verified.", registrationNumber: number };
    const message = result.data === "expired" ? "The verification window expired. Resend your number and enter it again."
      : result.data === "locked" ? "Too many incorrect attempts. Resend your number to try again."
      : result.data === "used" ? "This number is already assigned to an agency."
      : "The number could not be verified. Check the email and use its exact registration number.";
    return { ok: false, message };
  } catch {
    return { ok: false, message: "Registration-number verification is temporarily unavailable." };
  }
}

export async function requireVerifiedAgencyRegistrationNumber(rawEmail: string, rawNumber: string) {
  const email = normalizeEmail(rawEmail);
  const number = rawNumber.trim().toUpperCase();
  const proof = await readProof(email);
  if (!proof || !numberPattern.test(number)) throw new Error("Verify your Avera Privé registration number.");
  const result = await createAdminClient().from("ap_agency_registration_numbers")
    .select("id,registration_number").eq("id", proof.id).eq("email", email)
    .eq("proof_hash", digest(proof.secret)).eq("registration_number", number)
    .eq("delivery_status", "sent").is("agency_id", null)
    .not("verified_at", "is", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (result.error || !result.data) throw new Error("Verify your current Avera Privé registration number.");
  return result.data as { id: string; registration_number: string };
}
