import type { SupabaseClient } from "@supabase/supabase-js";

export type PlatformReview = {
  id: string;
  display_name: string;
  audience: "viewer" | "business";
  rating: number;
  title: string;
  body: string;
  published_at: string;
};

export type OwnReview = PlatformReview & {
  status: "pending" | "approved" | "rejected";
  revision: number;
  moderation_note: string | null;
};

export async function loadPlatformReviews(
  supabase: SupabaseClient,
  page = 1,
  size = 12,
) {
  const start = (page - 1) * size;

  const [summary, reviews] = await Promise.all([
    supabase
      .from("ap_platform_review_summary")
      .select("review_count,average_rating")
      .single(),
    supabase
      .from("ap_public_platform_reviews")
      .select("id,display_name,audience,rating,title,body,published_at")
      .order("published_at", { ascending: false })
      .order("id")
      .range(start, start + size - 1),
  ]);

  if (summary.error || reviews.error) return null;

  return {
    count: Number(summary.data.review_count),
    average:
      summary.data.average_rating === null
        ? null
        : Number(summary.data.average_rating),
    reviews: reviews.data as PlatformReview[],
  };
}

export function ReviewCard({ review }: { review: PlatformReview }) {
  return (
    <article className="pr-card">
      <header>
        <span className="pr-avatar" aria-hidden="true">
          {review.display_name[0]?.toUpperCase()}
        </span>
        <div>
          <strong>{review.display_name}</strong>
          <small>
            {review.audience === "business"
              ? "Business user"
              : "Creator / viewer"} · Self-described
          </small>
        </div>
      </header>

      <p
        className="pr-stars"
        aria-label={`${review.rating} out of 5 stars`}
      >
        {"★".repeat(review.rating)}
        <span aria-hidden="true">
          {"☆".repeat(5 - review.rating)}
        </span>
      </p>

      <h2>{review.title}</h2>
      <p className="pr-body">{review.body}</p>

      <time dateTime={review.published_at}>
        {new Date(review.published_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })}
      </time>
    </article>
  );
}