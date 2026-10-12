import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  loadPlatformReviews,
  ReviewCard,
} from "@/lib/reviews/platform";

export const metadata = {
  title: "Reviews of Avera Privé",
};

export default async function PlatformReviews({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const parsed = Number(query.page ?? 1);

  const page =
    Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 100000
      ? parsed
      : 1;

  const data = await loadPlatformReviews(await createClient(), page);

  return (
    <>
      <Link href="/">← Back to homepage</Link>

      <header className="pr-heading">
        <p className="pr-eyebrow">REVIEWS OF AVERA PRIVÉ</p>
        <h1>Your experience. Your voice.</h1>
        <p>
          Feedback about using the Avera Privé platform, separate from
          reviews of individual agencies.
        </p>

        {data && data.count > 0 && (
          <p className="pr-summary">
            <strong>{data.average?.toFixed(1)} / 5</strong>
            {" · "}
            {data.count} published{" "}
            {data.count === 1 ? "review" : "reviews"}
          </p>
        )}

        <Link className="pr-button" href="/platform-reviews/new">
          Write a review
        </Link>
      </header>

      <details className="pr-standards">
        <summary>How we publish platform reviews</summary>
        <p>
          One review per signed-in account with a confirmed email.
          Display names and audience labels are supplied by reviewers.
          Email confirmation does not verify a business relationship.
          We moderate for spam, impersonation, harassment, private
          information and relevance—not whether a rating is positive
          or negative. All approved ratings contribute equally to the
          average. Edits require approval again.
        </p>
      </details>

      {!data ? (
        <p role="alert">
          Reviews are temporarily unavailable. Please try again later.
        </p>
      ) : !data.count ? (
        <div className="pr-notice">
          <h2>Be the first to share your experience.</h2>
          <p>No platform reviews have been published yet.</p>
        </div>
      ) : (
        <>
          <div className="pr-grid">
            {data.reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>

          {!data.reviews.length && (
            <p>No reviews on this page.</p>
          )}

          <nav className="pr-actions" aria-label="Review pagination">
            {page > 1 && (
              <Link
                className="pr-button pr-secondary"
                href={`/platform-reviews?page=${page - 1}`}
              >
                Previous
              </Link>
            )}

            {page * 12 < data.count && (
              <Link
                className="pr-button pr-secondary"
                href={`/platform-reviews?page=${page + 1}`}
              >
                Next
              </Link>
            )}
          </nav>
        </>
      )}
    </>
  );
}