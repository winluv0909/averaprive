"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { provisionOnboardingAgency } from "@/lib/agencies/provision-onboarding";

type SocialProvider = "google" | "apple";

function agencySiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export async function signInWithSocial(
  provider: SocialProvider,
  intent: "login" | "register",
) {
  const supabase = await createClient();

  const next =
    intent === "register"
      ? "/agency/register?oauth=1"
      : "/agency/dashboard";

  const callback = new URL("/auth/callback", agencySiteUrl());
  callback.searchParams.set("next", next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callback.toString(),
    },
  });

  if (error || !data.url) {
    const path =
      intent === "register" ? "/agency/register" : "/agency/login";

    redirect(
      `${path}?error=${encodeURIComponent(
        error?.message ||
          `${provider === "google" ? "Google" : "Apple"} sign-in could not be started.`,
      )}`,
    );
  }

  redirect(data.url);
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/agency/dashboard");
  const loginPath = String(formData.get("loginPath") ?? "/agency/login");

  const safeLoginPath =
    loginPath === "/owners/login" ? "/owners/login" : "/agency/login";

  const portalPrefix =
    safeLoginPath === "/owners/login" ? "/owners/" : "/agency/";

  const defaultNext =
    safeLoginPath === "/owners/login"
      ? "/owners/dashboard"
      : "/agency/dashboard";

  const safeNext =
    next.startsWith(portalPrefix) && !next.startsWith("//")
      ? next
      : defaultNext;

  if (!email || !password) {
    redirect(
      `${safeLoginPath}?error=${encodeURIComponent(
        "Enter your email address and password.",
      )}`,
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      `${safeLoginPath}?error=${encodeURIComponent(
        "Invalid email or password.",
      )}`,
    );
  }

  if (safeLoginPath === "/owners/login") {
    const { data: staffRole } = await supabase
      .from("ap_staff_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!staffRole) {
      await supabase.auth.signOut();

      redirect(
        `/owners/login?error=${encodeURIComponent(
          "This account is not authorized for the private owner portal.",
        )}`,
      );
    }
  }

  if (safeLoginPath === "/agency/login") {
    try {
      await provisionOnboardingAgency(supabase, data.user);
    } catch (provisionError) {
      redirect(
        `/agency/login?error=${encodeURIComponent(
          provisionError instanceof Error
            ? provisionError.message
            : "Your agency profile could not be prepared.",
        )}`,
      );
    }
  }

  redirect(safeNext);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const agencyName = String(formData.get("agencyName") ?? "").trim();

  const requestedPlan = String(formData.get("plan") ?? "free").toLowerCase();

  const plan = ["free", "prive", "select", "elite"].includes(requestedPlan)
    ? requestedPlan
    : "free";

  const list = (key: string) =>
    String(formData.get(key) ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

  const services = [...list("services"), ...list("otherServices")];
  const creatorNiches = list("creatorNiches");
  const about = String(formData.get("about") ?? "").trim();
  const positioning = String(formData.get("positioning") ?? "").trim();
  const verificationNotes = String(
    formData.get("verificationNotes") ?? "",
  ).trim();
  const legalCompanyName = String(
    formData.get("legalCompanyName") ?? "",
  ).trim();
  const registrationNumber = String(
    formData.get("registrationNumber") ?? "",
  ).trim();

  if (
    !email ||
    password.length < 8 ||
    firstName.length < 1 ||
    lastName.length < 1 ||
    agencyName.length < 2 ||
    services.length < 1 ||
    about.length < 80 ||
    positioning.length < 20 ||
    !legalCompanyName ||
    !registrationNumber ||
    verificationNotes.length < 20
  ) {
    redirect(
      `/agency/register?error=${encodeURIComponent(
        "Complete every required field and use a password with at least 8 characters.",
      )}`,
    );
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      data: {
        display_name: [firstName, lastName].filter(Boolean).join(" "),
        agency_name: agencyName,
        requested_plan: plan,
        onboarding_profile: {
          agencyName,
          country: String(formData.get("country") ?? "").trim(),
          city: String(formData.get("city") ?? "").trim(),
          websiteUrl: String(formData.get("websiteUrl") ?? "").trim(),
          logoUrl: String(formData.get("logoUrl") ?? "").trim(),
          services,
          creatorNiches,
          regionsServed: list("regionsServed"),
          agencySize: String(formData.get("agencySize") ?? "").trim(),
          foundedYear: Number(formData.get("foundedYear")) || null,
          languages: list("languages"),
          positioning,
          about,
          instagram: String(formData.get("instagram") ?? "").trim(),
          linkedin: String(formData.get("linkedin") ?? "").trim(),
          verification: {
            legalCompanyName,
            registrationNumber,
            registrationCountry: String(
              formData.get("registrationCountry") ?? "",
            ).trim(),
            representative: String(
              formData.get("representative") ?? "",
            ).trim(),
            representativeTitle: String(
              formData.get("representativeTitle") ?? "",
            ).trim(),
            businessEmail: String(
              formData.get("businessEmail") ?? "",
            ).trim(),
            notes: verificationNotes,
          },
        },
      },
    },
  });

  if (error) {
    redirect(
      `/agency/register?error=${encodeURIComponent(error.message)}`,
    );
  }

  if (data.session && data.user) {
    let agencyId: string | null = null;

    try {
      agencyId = await provisionOnboardingAgency(supabase, data.user);
    } catch (provisionError) {
      redirect(
        `/agency/login?error=${encodeURIComponent(
          provisionError instanceof Error
            ? provisionError.message
            : "Your agency profile could not be prepared.",
        )}`,
      );
    }

    redirect(
      agencyId
        ? `/agency/dashboard/agencies/${agencyId}?submitted=1`
        : "/agency/dashboard",
    );
  }

  redirect(
    "/agency/login?message=Check your email to confirm your account.",
  );
}

export async function completeSocialSignUp(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/agency/register?error=${encodeURIComponent(
        "Your Google or Apple session expired. Please continue with your account again.",
      )}`,
    );
  }

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const agencyName = String(formData.get("agencyName") ?? "").trim();

  const requestedPlan = String(formData.get("plan") ?? "free").toLowerCase();

  const plan = ["free", "prive", "select", "elite"].includes(requestedPlan)
    ? requestedPlan
    : "free";

  const list = (key: string) =>
    String(formData.get(key) ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

  const services = [...list("services"), ...list("otherServices")];
  const creatorNiches = list("creatorNiches");
  const about = String(formData.get("about") ?? "").trim();
  const positioning = String(formData.get("positioning") ?? "").trim();
  const verificationNotes = String(
    formData.get("verificationNotes") ?? "",
  ).trim();
  const legalCompanyName = String(
    formData.get("legalCompanyName") ?? "",
  ).trim();
  const registrationNumber = String(
    formData.get("registrationNumber") ?? "",
  ).trim();

  if (
    firstName.length < 1 ||
    lastName.length < 1 ||
    agencyName.length < 2 ||
    services.length < 1 ||
    about.length < 80 ||
    positioning.length < 20 ||
    !legalCompanyName ||
    !registrationNumber ||
    verificationNotes.length < 20
  ) {
    redirect(
      `/agency/register?oauth=1&error=${encodeURIComponent(
        "Complete every required agency and verification field before submitting.",
      )}`,
    );
  }

  const onboardingProfile = {
    agencyName,
    country: String(formData.get("country") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    websiteUrl: String(formData.get("websiteUrl") ?? "").trim(),
    logoUrl: String(formData.get("logoUrl") ?? "").trim(),
    services,
    creatorNiches,
    regionsServed: list("regionsServed"),
    agencySize: String(formData.get("agencySize") ?? "").trim(),
    foundedYear: Number(formData.get("foundedYear")) || null,
    languages: list("languages"),
    positioning,
    about,
    instagram: String(formData.get("instagram") ?? "").trim(),
    linkedin: String(formData.get("linkedin") ?? "").trim(),
    verification: {
      legalCompanyName,
      registrationNumber,
      registrationCountry: String(
        formData.get("registrationCountry") ?? "",
      ).trim(),
      representative: String(
        formData.get("representative") ?? "",
      ).trim(),
      representativeTitle: String(
        formData.get("representativeTitle") ?? "",
      ).trim(),
      businessEmail: String(
        formData.get("businessEmail") ?? "",
      ).trim(),
      notes: verificationNotes,
    },
  };

  const { data, error } = await supabase.auth.updateUser({
    data: {
      display_name: [firstName, lastName].filter(Boolean).join(" "),
      agency_name: agencyName,
      requested_plan: plan,
      onboarding_profile: onboardingProfile,
    },
  });

  if (error || !data.user) {
    redirect(
      `/agency/register?oauth=1&error=${encodeURIComponent(
        error?.message || "The social account profile could not be saved.",
      )}`,
    );
  }

  try {
    const agencyId = await provisionOnboardingAgency(
      supabase,
      data.user,
    );

    redirect(
      agencyId
        ? `/agency/dashboard/agencies/${agencyId}?submitted=1`
        : "/agency/dashboard",
    );
  } catch (provisionError) {
    redirect(
      `/agency/register?oauth=1&error=${encodeURIComponent(
        provisionError instanceof Error
          ? provisionError.message
          : "Your agency profile could not be prepared.",
      )}`,
    );
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/agency/login");
}

export async function signOutAdmin() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/owners/login");
}