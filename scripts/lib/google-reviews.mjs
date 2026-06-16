import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Build-time mirror of src/data/google-reviews.json */
export function loadGoogleReviews(root) {
  const filePath = path.join(root, "src", "data", "google-reviews.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function buildAggregateRatingJsonLd(summary) {
  return {
    "@type": "AggregateRating",
    ratingValue: summary.ratingValue,
    reviewCount: summary.reviewCount,
    bestRating: 5,
    worstRating: 1
  };
}

export function buildReviewJsonLd(review) {
  return {
    "@type": "Review",
    author: { "@type": "Person", name: review.authorName },
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
