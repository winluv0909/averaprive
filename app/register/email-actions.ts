"use server";

import {
  sendRegistrationEmailCode,
  verifyRegistrationEmailCode,
} from "@/lib/auth/registration-email";

export async function requestRegistrationCode(email: string) {
  if (typeof email !== "string" || email.length > 254) {
    return { ok: false, message: "Enter a valid owner email address." };
  }

  return sendRegistrationEmailCode(email);
}

export async function confirmRegistrationCode(
  email: string,
  code: string,
) {
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    typeof code !== "string" ||
    !/^\d{8}$/.test(code.trim())
  ) {
    return {
      ok: false,
      message: "Enter your owner email and the eight-digit code.",
    };
  }

  return verifyRegistrationEmailCode(email, code);
}