import "server-only";

import { createHash, createHmac, randomBytes, randomInt, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const cookieName = "ap-registration-email";
const lifetime = 15 * 60;

type Result = { ok: boolean; message: string };
type Proof = { id: string; secret: string };

function signingKey() {
  const key = process.env.REGISTRATION_EMAIL_SECRET;
  if (!key || key.length < 32) {
    throw new Error("Registration email verification is not configured.");
  }
  return key;
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function keyedDigest(value: string) {
  return createHmac("sha256", signingKey()).update(value).digest("hex");
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("Enter a valid owner email address.");
  }
  return email;
}

async function readProof(): Promise<Proof | null> {
  const value = (await cookies()).get(cookieName)?.value;
  if (!value) return null;

  try {
    const proof = JSON.parse(value) as Proof;
    if (
      typeof proof.id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(proof.id) ||
      typeof proof.secret !== "string" ||
      !/^[0-9a-f]{64}$/.test(proof.secret)
    ) {
      return null;
    }
    return proof;
  } catch {
    return null;
  }
}

function codeDigest(proof: Proof, email: string, code: string) {
  return keyedDigest(
    JSON.stringify(["registration-email-v1", proof.id, email, proof.secret, code]),
  );
}

export async function sendRegistrationEmailCode(
  rawEmail: string,
): Promise<Result> {
  try {
    const email = normalizeEmail(rawEmail);
    signingKey();

    const apiKey = process.env.RESEND_API_KEY;
    const from =
      process.env.REGISTRATION_EMAIL_FROM ||
      process.env.PAYMENT_EMAIL_FROM;

    if (!apiKey || !from) {
      return {
        ok: false,
        message: "Verification email is not configured. Please contact support.",
      };
    }

    const proof: Proof = {
      id: randomUUID(),
      secret: randomBytes(32).toString("hex"),
    };
    const code = String(randomInt(10_000_000, 100_000_000));

    const requestHeaders = await headers();
    const address =
      requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      requestHeaders.get("x-real-ip")?.trim() ||
      "unavailable";

    const db = createAdminClient();
    const created = await db.rpc("ap_begin_registration_email_check", {
      check_id: proof.id,
      target_email: email,
      target_visitor_hash: keyedDigest(`registration-visitor:${address}`),
      target_proof_hash: digest(proof.secret),
      target_code_hash: codeDigest(proof, email, code),
    });

    if (created.error) {
      const message = created.error.message;
      return {
        ok: false,
        message: message.includes("COOLDOWN")
          ? "Wait 60 seconds before requesting another code."
          : message.includes("RATE_LIMIT")
            ? "Too many requests. Please try again later."
            : "Verification is temporarily unavailable. Please retry.",
      };
    }

    let delivered = false;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `registration-${proof.id}`,
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: "Your Avera Privé verification code",
          text: [
            `Your Avera Privé verification code is: ${code}`,
            "",
            "It expires in 15 minutes. Enter it in the browser where you requested it.",
            "This verifies your email address only. It is not a business registration number or an agency verification badge.",
            "If you did not request this code, you can ignore this email.",
          ].join("\n"),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      delivered = response.ok;
    } catch {
      delivered = false;
    }

    const saved = await db
      .from("ap_registration_email_checks")
      .update({ delivery_status: delivered ? "sent" : "failed" })
      .eq("id", proof.id)
      .select("id")
      .single();

    if (!delivered || saved.error || !saved.data) {
      return {
        ok: false,
        message: "The code could not be sent. Wait 60 seconds and retry.",
      };
    }

    (await cookies()).set(cookieName, JSON.stringify(proof), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: lifetime,
    });

    return {
      ok: true,
      message: "Code sent. Check your inbox and spam folder.",
    };
  } catch {
    return {
      ok: false,
      message: "Check the email address or try again later.",
    };
  }
}

export async function verifyRegistrationEmailCode(
  rawEmail: string,
  rawCode: string,
): Promise<Result> {
  try {
    const email = normalizeEmail(rawEmail);
    const code = rawCode.trim();
    const proof = await readProof();

    if (!proof || !/^\d{8}$/.test(code)) {
      return {
        ok: false,
        message: "Request a code and enter its eight digits in this browser.",
      };
    }

    const result = await createAdminClient().rpc(
      "ap_verify_registration_email_check",
      {
        check_id: proof.id,
        target_email: email,
        target_proof_hash: digest(proof.secret),
        supplied_code_hash: codeDigest(proof, email, code),
      },
    );

    if (result.error) {
      return { ok: false, message: "Verification is unavailable. Please retry." };
    }

    if (result.data === "verified") {
      return { ok: true, message: "Owner email verified." };
    }

    return {
      ok: false,
      message:
        result.data === "expired"
          ? "This code expired. Request a new code."
          : result.data === "locked"
            ? "Too many incorrect attempts. Request a new code."
            : "The code could not be verified. Check the email and code.",
    };
  } catch {
    return { ok: false, message: "Verification is unavailable. Please retry." };
  }
}

export async function requireVerifiedRegistrationEmail(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const proof = await readProof();

  if (!proof) {
    throw new Error("Verify your owner email before submitting registration.");
  }

  const result = await createAdminClient()
    .from("ap_registration_email_checks")
    .select("id")
    .eq("id", proof.id)
    .eq("email", email)
    .eq("proof_hash", digest(proof.secret))
    .eq("delivery_status", "sent")
    .not("verified_at", "is", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (result.error || !result.data) {
    throw new Error("Verify your current owner email before submitting registration.");
  }
}