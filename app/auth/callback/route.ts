import {
  NextResponse,
  type NextRequest,
} from "next/server";

import type {
  EmailOtpType,
  User,
} from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

import { getAgencyPortalAccessError } from "@/lib/auth/authorization";

import { provisionOnboardingAgency } from "@/lib/agencies/provision-onboarding";

export async function GET(request: NextRequest) {
  const code =
    request.nextUrl.searchParams.get("code");

  const tokenHash =
    request.nextUrl.searchParams.get("token_hash");

  const type = request.nextUrl.searchParams.get(
    "type",
  ) as EmailOtpType | null;

  const providerError =
    request.nextUrl.searchParams.get(
      "error_description",
    );

  const requestedNext =
    request.nextUrl.searchParams.get("next") ||
    "/agency/dashboard";

  const safeNext =
    (requestedNext === "/agency/register?oauth=1" || /^\/agency\/claim\/[a-z0-9-]+$/.test(requestedNext))
      ? requestedNext
      : "/agency/dashboard";

  const supabase = await createClient();

  let user: User | null = null;
  let authenticationError: string | null =
    providerError;

  if (code) {
    const { data, error } =
      await supabase.auth.exchangeCodeForSession(
        code,
      );

    user = data.user;
    authenticationError = error?.message ?? null;
  } else if (tokenHash && type) {
    const { data, error } =
      await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

    user = data.user;
    authenticationError = error?.message ?? null;
  }

  if (user) {
    const accessError = await getAgencyPortalAccessError(supabase, user.id);
    if (accessError) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL(`/agency/login?error=${encodeURIComponent(accessError)}`, request.url));
    }
    if (safeNext.startsWith("/agency/register") || safeNext.startsWith("/agency/claim/")) {
      return NextResponse.redirect(
        new URL(safeNext, request.url),
      );
    }

    try {
      const agencyId =
        await provisionOnboardingAgency(
          supabase,
          user,
        );

      return NextResponse.redirect(
        new URL(
          agencyId
            ? `/agency/dashboard/agencies/${agencyId}?submitted=1`
            : "/agency/dashboard",
          request.url,
        ),
      );
    } catch (provisionError) {
      const message =
        provisionError instanceof Error
          ? provisionError.message
          : "Your agency profile could not be prepared.";

      return NextResponse.redirect(
        new URL(
          `/agency/login?error=${encodeURIComponent(
            message,
          )}`,
          request.url,
        ),
      );
    }
  }

  const message =
    authenticationError ||
    "The confirmation link is invalid, incomplete, or expired. Request a new confirmation email and try again.";

  const errorPath = safeNext.startsWith(
    "/agency/register",
  )
    ? "/agency/register"
    : "/agency/login";

  return NextResponse.redirect(
    new URL(
      `${errorPath}?error=${encodeURIComponent(
        message,
      )}`,
      request.url,
    ),
  );
}