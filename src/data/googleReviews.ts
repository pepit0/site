/** Temptation Motorsports Google Business Profile reviews — sync via npm run google-reviews:sync */

import reviewsData from "./google-reviews.json";

export type GoogleReview = {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  publishedAt?: string;
  relativeTime?: string;
};

export type GoogleReviewsSummary = {
  ratingValue: number;
  reviewCount: number;
  sourceLabel: string;
};

export const GOOGLE_REVIEWS_SUMMARY = reviewsData.summary as GoogleReviewsSummary;

export const GOOGLE_REVIEWS: readonly GoogleReview[] = reviewsData.reviews as GoogleReview[];

/** True when we have synced Temptation Motorsports Google review data (not another listing). */
export function hasPublishedGoogleReviews(): boolean {
  return GOOGLE_REVIEWS.length > 0 && GOOGLE_REVIEWS_SUMMARY.reviewCount > 0;
}

/** Reviews shown in the home page marquee (positive Google reviews only). */
export const HOME_FEATURED_REVIEWS = GOOGLE_REVIEWS.filter((review) => review.rating >= 4);

/** Five-star reviews for the home hero carousel. */
export const HOME_HERO_FIVE_STAR_REVIEWS = GOOGLE_REVIEWS.filter((review) => review.rating === 5);

export const REVIEWS_PAGE_SEO = {
  title: "Customer reviews",
  description:
    "Read Google reviews for Temptation Motorsports in Sherwood Park, Alberta. Powersports and motorsports financing and rides for sale across Canada."
} as const;

export const REVIEWS_PAGE_HERO = {
  h1: "What our customers are saying",
  tagline: "Real reviews from Google — financing, inventory, and sell-your-ride help across Canada."
} as const;

export const HOME_REVIEWS_SECTION = {
  heading: "See what our customers are saying",
  subheading: "Rated {rating} on Google from {count} reviews",
  pendingSubheading: "Read Temptation Motorsports reviews on Google",
  viewAllLabel: "Read all reviews",
  onGoogleLabel: "See all reviews on Google",
  readMoreLabel: "Read more"
} as const;

export const HOME_HERO_REVIEW_CAROUSEL = {
  heading: "Reviews from Canadians we've helped!"
} as const;

/** Max characters shown in the home hero review carousel card. */
export const HOME_HERO_REVIEW_MAX_CHARS = 200;

/** Max characters shown in the home review slider before "Read more". */
export const HOME_REVIEW_PREVIEW_MAX_CHARS = 110;

export function googleReviewDetailPath(reviewId: string): string {
  return `/reviews#${encodeURIComponent(reviewId)}`;
}

export function truncateReviewText(
  text: string,
  maxChars: number
): { preview: string; isTruncated: boolean } {
  const normalized = text.trim();
  if (normalized.length <= maxChars) {
    return { preview: normalized, isTruncated: false };
  }

  const slice = normalized.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxChars * 0.55 ? slice.slice(0, lastSpace) : slice;

  return { preview: `${cut.trimEnd()}…`, isTruncated: true };
}
