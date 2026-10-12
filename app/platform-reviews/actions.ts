"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReviewResult = {
  error?: string;
  success?: boolean;
};

export async function submitPlatformReview(
  _previous: ReviewResult,
  form: FormData,
): Promise<ReviewResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "Your session expired. Sign in again; your review has not been submitted.",
    };
  }

  const { error } = await supabase.rpc("ap_submit_platform_review", {
    public_name: String(form.get("display_name") ?? ""),
    reviewer_audience: String(form.get("audience") ?? ""),
    review_rating: Number(form.get("rating")),
    review_title: String(form.get("title") ?? ""),
    review_body: String(form.get("body") ?? ""),
    truthful: form.get("truthful") === "on",
    expected_revision: Number(form.get("revision")),
  });

  if (error) return { error: error.message };

  revalidatePath("/platform-reviews");
  revalidatePath("/owners/dashboard/platform-reviews");

  return { success: true };
}

function callbackUrl() {
  return new URL(
    "/platform-reviews/auth/callback",
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ).toString();
}

function authError(message: string): never {
  redirect(`/platform-reviews/new?error=${encodeURIComponent(message)}`);
}

export async function reviewSignIn(form: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
  });

  if (error) {
    authError(
      "Unable to sign in. Check your email and password, and confirm your email if needed.",
    );
  }

  redirect("/platform-reviews/new");
}

export async function reviewSignUp(form: FormData) {
  const supabase = await createClient();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!email || password.length < 8) {
    authError("Enter your email and a password with at least 8 characters.");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl(),
    },
  });

  if (error) authError(error.message);
  if (data.session) redirect("/platform-reviews/new");

  redirect("/platform-reviews/new?checkEmail=1");
}

export async function reviewGoogleSignIn() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl(),
    },
  });

  if (error || !data.url) {
    authError(
      "Google sign-in could not be started. You can use email sign-in below.",
    );
  }

  redirect(data.url);
}

export async function reviewSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/platform-reviews/new");
}