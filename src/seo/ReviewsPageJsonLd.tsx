import { Helmet } from "react-helmet-async";
import { GOOGLE_REVIEWS, GOOGLE_REVIEWS_SUMMARY, REVIEWS_PAGE_SEO } from "../data/googleReviews";
import { buildOrganizationJsonLd, getPublicBusinessProfile } from "../lib/businessPublic";
import { buildReviewsPageJsonLd } from "../lib/googleReviewsSchema";
import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";

export function ReviewsPageJsonLd() {
  if (!hasPublicSiteOrigin()) return null;

  const profile = getPublicBusinessProfile();
  const organization = buildOrganizationJsonLd(profile, {
    pageUrl: absoluteUrl("/"),
    description: REVIEWS_PAGE_SEO.description,
    types: ["LocalBusiness", "AutomotiveBusiness", "FinancialService"]
  });

  const jsonLd = buildReviewsPageJsonLd({
    pageUrl: absoluteUrl("/reviews"),
    description: REVIEWS_PAGE_SEO.description,
    organization,
    summary: GOOGLE_REVIEWS_SUMMARY,
    reviews: GOOGLE_REVIEWS
  });

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}
