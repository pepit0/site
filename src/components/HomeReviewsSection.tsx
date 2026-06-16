import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  GOOGLE_REVIEWS_SUMMARY,
  hasPublishedGoogleReviews,
  HOME_FEATURED_REVIEWS,
  HOME_REVIEWS_SECTION
} from "../data/googleReviews";
import { getPublicBusinessProfile } from "../lib/businessPublic";
import { GoogleReviewCard } from "./GoogleReviewCard";
import { GoogleReviewStars } from "./GoogleReviewStars";

export function HomeReviewsSection() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const profile = getPublicBusinessProfile();
  const googleMapsUrl = profile.googleMapsUrl;
  const hasReviews = hasPublishedGoogleReviews();
  const subheading = hasReviews
    ? HOME_REVIEWS_SECTION.subheading
        .replace("{rating}", GOOGLE_REVIEWS_SUMMARY.ratingValue.toFixed(1))
        .replace("{count}", String(GOOGLE_REVIEWS_SUMMARY.reviewCount))
    : HOME_REVIEWS_SECTION.pendingSubheading;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!hasReviews && !googleMapsUrl) return null;

  const cards = HOME_FEATURED_REVIEWS.map((review) => (
    <GoogleReviewCard key={review.id} review={review} compact />
  ));

  return (
    <section className="home-reviewsSection" aria-labelledby="home-reviews-heading">
      <div className="home-reviewsHeader">
        <div className="home-reviewsHeaderCopy">
          <h2 id="home-reviews-heading" className="home-reviewsTitle">
            {HOME_REVIEWS_SECTION.heading}
          </h2>
          <p className="home-reviewsSummary">
            {hasReviews ? (
              <GoogleReviewStars
                rating={GOOGLE_REVIEWS_SUMMARY.ratingValue}
                className="home-reviewsSummaryStars"
                label={`${GOOGLE_REVIEWS_SUMMARY.ratingValue} out of 5 stars on Google`}
              />
            ) : null}
            <span>{subheading}</span>
          </p>
        </div>
        <div className="home-reviewsActions">
          {hasReviews ? (
            <Link to="/reviews" className="btn btn-secondary home-reviewsActionBtn">
              {HOME_REVIEWS_SECTION.viewAllLabel}
            </Link>
          ) : null}
          {googleMapsUrl ? (
            <a
              href={googleMapsUrl}
              className="btn btn-secondary home-reviewsActionBtn"
              target="_blank"
              rel="noopener noreferrer"
            >
              {HOME_REVIEWS_SECTION.onGoogleLabel}
            </a>
          ) : null}
        </div>
      </div>

      {hasReviews ? (
        reduceMotion ? (
          <div className="home-reviewsStatic" aria-label="Customer reviews">
            {cards}
          </div>
        ) : (
          <div className="home-reviewsBelt" aria-label="Customer reviews">
            <div className="home-reviewsViewport">
              <div className="home-reviewsTrack">
                {cards}
                {cards}
              </div>
            </div>
          </div>
        )
      ) : null}
    </section>
  );
}
