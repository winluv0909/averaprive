"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { submitPlatformReview } from "./actions";
import type { OwnReview } from "@/lib/reviews/platform";

export default function ReviewForm({
  existing,
}: {
  existing: OwnReview | null;
}) {
  const [result, submit, pending] = useActionState(
    submitPlatformReview,
    {},
  );
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [preview, setPreview] = useState<{
    name: string;
    title: string;
    body: string;
  } | null>(null);

  const formRef = useRef<HTMLFormElement>(null);

  if (result.success) {
    return (
      <div className="pr-notice" role="status">
        <h2>Review submitted</h2>
        <p>
          Your review is pending approval. It will appear on the homepage
          after approval.
        </p>
        <div className="pr-actions">
          <Link className="pr-button" href="/">
            Back to homepage
          </Link>
          <a
            className="pr-button pr-secondary"
            href="/platform-reviews/new"
          >
            View my review status
          </a>
        </div>
      </div>
    );
  }

  return (
    <form className="pr-form" ref={formRef} action={submit}>
      <input
        type="hidden"
        name="revision"
        value={existing?.revision ?? 0}
      />

      <fieldset disabled={pending}>
        <legend>Your rating</legend>

        <div className="pr-rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              className={value <= rating ? "selected" : ""}
            >
              <input
                type="radio"
                name="rating"
                value={value}
                required
                checked={rating === value}
                onChange={() => {
                  setRating(value);
                  setPreview(null);
                }}
                aria-label={`${value} ${
                  value === 1 ? "star" : "stars"
                }`}
              />
              <span aria-hidden="true">★</span>
            </label>
          ))}
        </div>

        <p>{rating ? `${rating} out of 5` : "Choose 1–5 stars"}</p>
      </fieldset>

      <fieldset
        disabled={pending}
        className="pr-fields"
        onChange={() => setPreview(null)}
      >
        <legend className="pr-sr-only">Review details</legend>

        <label>
          Review title
          <input
            name="title"
            defaultValue={existing?.title ?? ""}
            required
            minLength={3}
            maxLength={120}
            placeholder="Summarize your experience"
          />
        </label>

        <label>
          Your review
          <textarea
            name="body"
            defaultValue={existing?.body ?? ""}
            required
            minLength={20}
            maxLength={3000}
            rows={6}
            placeholder="Tell us what worked well and what we could improve. Please leave out private information."
          />
        </label>

        <label>
          I am a
          <select
            name="audience"
            defaultValue={existing?.audience ?? "viewer"}
            required
          >
            <option value="viewer">Creator / viewer</option>
            <option value="business">Business user</option>
          </select>
        </label>

        <label>
          Public display name
          <input
            name="display_name"
            defaultValue={existing?.display_name ?? ""}
            required
            minLength={2}
            maxLength={60}
            placeholder="For example, Alex R."
          />
        </label>

        <label className="pr-checkbox">
          <input type="checkbox" name="truthful" required />
          My review reflects my own experience using Avera Privé.
        </label>
      </fieldset>

      <p className="pr-notice">
        Your review will appear after approval. Positive and negative
        reviews follow the same standards. Editing a published review
        removes it from public display until approved again.
      </p>

      {result.error && (
        <p className="pr-error" role="alert">
          {result.error}
        </p>
      )}

      {preview && (
        <section
          className="pr-preview"
          aria-label="Your review preview"
        >
          <small>PREVIEW · NOT SUBMITTED</small>
          <h2>{preview.title}</h2>
          <p className="pr-stars">
            {"★".repeat(rating)}
            {"☆".repeat(5 - rating)}
          </p>
          <p className="pr-body">{preview.body}</p>
          <strong>{preview.name}</strong>
        </section>
      )}

      <div className="pr-actions">
        <button
          className="pr-button pr-secondary"
          type="button"
          disabled={pending}
          onClick={() => {
            const form = formRef.current;
            if (!form || !form.reportValidity()) return;

            const values = new FormData(form);

            setPreview({
              name: String(values.get("display_name")),
              title: String(values.get("title")),
              body: String(values.get("body")),
            });
          }}
        >
          Preview review
        </button>

        <button
          className="pr-button"
          type="submit"
          disabled={pending}
        >
          {pending
            ? "Submitting…"
            : existing
              ? "Submit updated review"
              : "Submit review"}
        </button>
      </div>
    </form>
  );
}