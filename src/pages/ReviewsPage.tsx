import { useEffect } from "react";
import { Link } from "react-router-dom";
import { GoogleReviewCard } from "../components/GoogleReviewCard";
import { GoogleReviewStars } from "../components/GoogleReviewStars";
import {
  GOOGLE_REVIEWS,
  GOOGLE_REVIEWS_SUMMARY,
  hasPublishedGoogleReviews,
  REVIEWS_PAGE_HERO,
  REVIEWS_PAGE_SEO
} from "../data/googleReviews";
import { getPublicBusinessProfile } from "../lib/businessPublic";
import { BreadcrumbJsonLd } from "../seo/BreadcrumbJsonLd";
import { ReviewsPageJsonLd } from "../seo/ReviewsPageJsonLd";
import { Seo } from "../seo/Seo";

export function ReviewsPage() {
  const profile = getPublicBusinessProfile();
  const googleMapsUrl = profile.googleMapsUrl;
  const hasReviews = hasPublishedGoogleReviews();
  const summaryLine = hasReviews
    ? `${GOOGLE_REVIEWS_SUMMARY.ratingValue.toFixed(1)} out of 5 · ${GOOGLE_REVIEWS_SUMMARY.reviewCount} Google reviews`
    : "Google reviews for Temptation Motorsports";

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;

    const scrollToReview = () => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    requestAnimationFrame(scrollToReview);
  }, []);

  return (
    <div className="reviews-page">
      <Seo title={REVIEWS_PAGE_SEO.title} description={REVIEWS_PAGE_SEO.description} path="/reviews" />
      <ReviewsPageJsonLd />
      <BreadcrumbJsonLd items={[{ name: "Reviews", path: "/reviews" }]} />

      <header className="page-header">
        <nav className="reviews-pageBreadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden> / </span>
          <span aria-current="page">Reviews</span>
        </nav>
        <h1 className="page-title">{REVIEWS_PAGE_HERO.h1}</h1>
        <p className="page-subtitle">{REVIEWS_PAGE_HERO.tagline}</p>
      </header>

      <div className="reviews-pageStack">
        <section className="card card-pad reviews-pageSummary" aria-label="Google rating summary">
          {hasReviews ? (
            <GoogleReviewStars
              rating={GOOGLE_REVIEWS_SUMMARY.ratingValue}
              className="reviews-pageSummaryStars"
              label={summaryLine}
            />
          ) : null}
          <p className="reviews-pageSummaryText">{summaryLine}</p>
          <p className="reviews-pageSummaryNote">
            {hasReviews
              ? "These reviews are from the Temptation Motorsports Google Business Profile. Visit Google to read the latest reviews or leave your own."
              : "Reviews will appear here once your Temptation Motorsports Google Business Profile is linked. Visit Google to read reviews or leave your own."}
          </p>
          <div className="reviews-pageSummaryActions">
            {googleMapsUrl ? (
              <a
                href={googleMapsUrl}
                className="btn btn-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                See all reviews on Google
              </a>
            ) : null}
            <Link to="/apply" className="btn btn-secondary">
              Apply for financing
            </Link>
          </div>
        </section>

        {hasReviews ? (
          <div className="reviews-pageGrid" aria-label="Customer reviews">
            {GOOGLE_REVIEWS.map((review) => (
              <GoogleReviewCard key={review.id} review={review} anchorId={review.id} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
