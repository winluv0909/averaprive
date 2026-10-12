import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { OwnReview } from "@/lib/reviews/platform";
import ReviewForm from "../ReviewForm";
import {
  reviewSignIn,
  reviewSignUp,
  reviewGoogleSignIn,
  reviewSignOut,
} from "../actions";

export const metadata = {
  title: "Write a platform review",
  robots: { index: false, follow: false },
};

export default async function WriteReview({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const own = user
    ? await supabase
        .from("ap_platform_reviews")
        .select(
          "id,display_name,audience,rating,title,body,published_at,status,revision,moderation_note",
        )
        .eq("user_id", user.id)
        .maybeSingle()
    : null;

  const staff = user
    ? await supabase
        .from("ap_staff_roles")
        .select("role")
        .eq("user_id", user.id)
    : null;

  return (
    <div className="pr-write">
      <Link className="pr-back" href="/">
        ← Back to homepage
      </Link>

      <header className="pr-write-hero">
        <div>
          <p className="pr-eyebrow">THE AVERA PRIVÉ EXPERIENCE</p>
          <h1>
            Your perspective.
            <br />
            <em>Our next chapter.</em>
          </h1>
          <p>
            Share what worked, what could be better, and what you
            would like to see next. Your experience helps shape
            Avera Privé.
          </p>
          <span className="pr-hero-caption">
            PLATFORM FEEDBACK · YOUR OWN EXPERIENCE
          </span>
        </div>

        <ol className="pr-review-steps" aria-label="Review process">
          <li>
            <span>01</span>
            <div>
              <strong>Share</strong>
              <p>Rate your experience and tell your story.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Preview</strong>
              <p>Check how your review will appear.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Publish</strong>
              <p>Approved reviews appear on the website.</p>
            </div>
          </li>
        </ol>
      </header>

      <div className="pr-write-layout">
        <aside className="pr-writing-guide">
          <p className="pr-eyebrow">A THOUGHTFUL REVIEW</p>
          <h2>
            Small details.
            <br />
            Meaningful feedback.
          </h2>
          <p>
            You do not need a perfect review. Just an honest account
            of your experience.
          </p>

          <ul>
            <li>What brought you to Avera Privé?</li>
            <li>What was useful or easy to navigate?</li>
            <li>What could we improve?</li>
          </ul>

          <div className="pr-guide-note">
            <span aria-hidden="true">◇</span>
            <p>
              Positive and negative experiences follow the same
              publication standards.
            </p>
          </div>

          <p className="pr-guide-bottom">
            Reviewing an individual agency?
            <Link href="/agencies.html">Find its profile →</Link>
          </p>
        </aside>

        <section
          className="pr-compose"
          aria-labelledby="reviewFormHeading"
        >
          <div className="pr-compose-heading">
            <p className="pr-eyebrow">YOUR VOICE MATTERS</p>
            <h2 id="reviewFormHeading">Share your experience</h2>
            <p>One review per account. You can update it later.</p>
          </div>

          {query.error && (
            <p className="pr-error" role="alert">
              {query.error}
            </p>
          )}

          {query.checkEmail && (
            <p className="pr-notice" role="status">
              Check your email for a confirmation link. If you
              already have an account, sign in below using your
              original sign-in method.
            </p>
          )}

          {!user ? (
            <section className="pr-auth">
              <p>
                Sign in to write a review. Existing business users
                can use their current account. New viewers can join
                here without creating an agency profile.
              </p>

              <form action={reviewGoogleSignIn}>
                <button className="pr-button pr-secondary">
                  Continue with Google
                </button>
              </form>

              <div className="pr-grid">
                <form className="pr-form" action={reviewSignIn}>
                  <h2>Sign in</h2>

                  <label>
                    Email
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                    />
                  </label>

                  <label>
                    Password
                    <input
                      type="password"
                      name="password"
                      autoComplete="current-password"
                      required
                    />
                  </label>

                  <button className="pr-button">Sign in</button>
                </form>

                <form className="pr-form" action={reviewSignUp}>
                  <h2>Create a viewer account</h2>

                  <label>
                    Email
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                    />
                  </label>

                  <label>
                    Password
                    <input
                      type="password"
                      name="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                    />
                  </label>

                  <p>
                    Use a password with at least 8 characters.
                    Confirm your email before reviewing.
                  </p>

                  <button className="pr-button">
                    Create account
                  </button>
                </form>
              </div>
            </section>
          ) : (
            <>
              <div className="pr-account">
                <div>
                  <span className="pr-account-label">
                    YOUR ACCOUNT
                  </span>
                  <p>{user.email}</p>
                </div>

                <form action={reviewSignOut}>
                  <button className="pr-button pr-secondary">
                    Sign out
                  </button>
                </form>
              </div>

              {own?.error || staff?.error ? (
                <p className="pr-error" role="alert">
                  Your account or review could not be loaded.
                  Please try again after applying the platform
                  review migration.
                </p>
              ) : staff?.data?.length ? (
                <p className="pr-notice">
                  Platform staff cannot review their own platform.
                </p>
              ) : !user.email_confirmed_at ? (
                <p className="pr-notice">
                  Confirm your email address before writing a review.
                </p>
              ) : (
                <>
                  {own?.data && (
                    <div className="pr-notice">
                      <strong>
                        Your review: {own.data.status}
                      </strong>

                      {own.data.moderation_note && (
                        <p>
                          Moderation explanation:{" "}
                          {own.data.moderation_note}
                        </p>
                      )}

                      <p>
                        You can update your review below.
                        Updates return to the approval queue.
                      </p>
                    </div>
                  )}

                  <ReviewForm
                    existing={
                      (own?.data as OwnReview | null) ?? null
                    }
                  />
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}