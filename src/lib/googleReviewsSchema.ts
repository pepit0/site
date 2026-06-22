import type { GoogleReview, GoogleReviewsSummary } from "../data/googleReviews";
import { REVIEWS_PAGE_SEO } from "../data/googleReviews";
import { BUSINESS_NAME } from "./businessPublic";

export function buildAggregateRatingJsonLd(summary: GoogleReviewsSummary): Record<string, unknown> {
  return {
    "@type": "AggregateRating",
    ratingValue: summary.ratingValue,
    reviewCount: summary.reviewCount,
    bestRating: 5,
    worstRating: 1
  };
}

export function buildReviewJsonLd(review: GoogleReview): Record<string, unknown> {
  return {
    "@type": "Review",
    author: {
      "@type": "Person",
      name: review.authorName
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 1
    },
    reviewBody: review.text,
    ...(review.publishedAt ? { datePublished: review.publishedAt } : {})
  };
}

export function withGoogleReviewsSchema(
  organization: Record<string, unknown>,
  options: {
    summary: GoogleReviewsSummary;
    reviews: readonly GoogleReview[];
  }
): Record<string, unknown> {
  const hasSummary = options.summary.reviewCount > 0 && options.summary.ratingValue > 0;
  const reviewNodes = options.reviews.map(buildReviewJsonLd);

  return {
    ...organization,
    ...(hasSummary ? { aggregateRating: buildAggregateRatingJsonLd(options.summary) } : {}),
    ...(reviewNodes.length > 0 ? { review: reviewNodes } : {})
  };
}

export function buildReviewsPageJsonLd(options: {
  pageUrl: string;
  description: string;
  organization: Record<string, unknown>;
  summary: GoogleReviewsSummary;
  reviews: readonly GoogleReview[];
}): Record<string, unknown> {
  const orgId = `${options.pageUrl}#organization`;
  const { "@context": _ctx, ...orgBase } = options.organization;
  const organization = withGoogleReviewsSchema(
    { ...orgBase, "@id": orgId },
    {
      summary: options.summary,
      reviews: options.reviews
    }
  );

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: `${REVIEWS_PAGE_SEO.title} | ${BUSINESS_NAME}`,
        description: options.description,
        url: options.pageUrl,
        mainEntity: { "@id": orgId }
      },
      organization
    ]
  };
}
