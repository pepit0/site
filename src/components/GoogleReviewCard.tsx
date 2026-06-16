import {
  googleReviewDetailPath,
  HOME_REVIEW_PREVIEW_MAX_CHARS,
  HOME_REVIEWS_SECTION,
  truncateReviewText,
  type GoogleReview
} from "../data/googleReviews";
import { PageSlideLink } from "./PageSlideLink";
import { GoogleReviewStars } from "./GoogleReviewStars";

type GoogleReviewCardProps = {
  review: GoogleReview;
  /** Shorter preview for the home page slider. */
  compact?: boolean;
  /** Anchor id for /reviews# links (full review page). */
  anchorId?: string;
};

function formatReviewDate(review: GoogleReview): string | null {
  if (review.relativeTime) return review.relativeTime;
  if (!review.publishedAt) return null;
  const date = new Date(`${review.publishedAt}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-CA", { month: "short", year: "numeric" });
}

export function GoogleReviewCard({ review, compact = false, anchorId }: GoogleReviewCardProps) {
  const dateLabel = formatReviewDate(review);
  const { preview, isTruncated } = compact
    ? truncateReviewText(review.text, HOME_REVIEW_PREVIEW_MAX_CHARS)
    : { preview: review.text, isTruncated: false };

  return (
    <figure
      id={anchorId}
      className={`home-reviewsCard${compact ? " home-reviewsCard--compact" : ""}${anchorId ? " home-reviewsCard--anchored" : ""}`}
    >
      <GoogleReviewStars rating={review.rating} />
      <blockquote className={`home-reviewsQuote${compact ? " home-reviewsQuote--compact" : ""}`}>
        "{preview}"
      </blockquote>
      {compact && isTruncated ? (
        <PageSlideLink
          to={googleReviewDetailPath(review.id)}
          className="home-reviewsReadMore"
          aria-label={`Read full review from ${review.authorName}`}
        >
          <span>{HOME_REVIEWS_SECTION.readMoreLabel}</span>
          <span className="home-reviewsReadMoreArrow" aria-hidden>
            →
          </span>
        </PageSlideLink>
      ) : null}
      <figcaption className="home-reviewsCaption">
        <p className="home-reviewsByline">
          —{" "}
          <cite className="home-reviewsAuthor">{review.authorName}</cite>
          {dateLabel ? <span className="home-reviewsWhen"> ({dateLabel})</span> : null}
        </p>
        <p className="home-reviewsSource">Google review</p>
      </figcaption>
    </figure>
  );
}
