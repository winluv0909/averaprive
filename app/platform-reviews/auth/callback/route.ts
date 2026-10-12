import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const code = request.nextUrl.searchParams.get("code");
  const hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : hash && ["signup", "email", "magiclink"].includes(type ?? "")
      ? await supabase.auth.verifyOtp({
          token_hash: hash,
          type: type as EmailOtpType,
        })
      : null;

  const destination = new URL(
    "/platform-reviews/new",
    request.url,
  );

  if (!result?.data.user || result.error) {
    destination.searchParams.set(
      "error",
      "Sign-in or email confirmation did not complete. Please try again.",
    );
  }

  // Reviewer accounts never provision an agency profile.
  return NextResponse.redirect(destination);
}