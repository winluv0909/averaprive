"use server";

import { sendAgencyRegistrationNumber, verifyAgencyRegistrationNumber, type RegistrationNumberResult } from "@/lib/auth/agency-registration-number";

export async function requestAgencyRegistrationNumber(email: string): Promise<RegistrationNumberResult> {
  if (typeof email !== "string" || email.length > 254) return { ok: false, message: "Enter a valid owner email address." };
  return sendAgencyRegistrationNumber(email);
}
export async function confirmAgencyRegistrationNumber(email: string, number: string): Promise<RegistrationNumberResult> {
  if (typeof email !== "string" || email.length > 254 || typeof number !== "string" || number.length > 64) {
    return { ok: false, message: "Enter the registration number emailed to you." };
  }
  return verifyAgencyRegistrationNumber(email, number);
}
