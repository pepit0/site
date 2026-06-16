import { Helmet } from "react-helmet-async";
import { GOOGLE_REVIEWS_SUMMARY, HOME_FEATURED_REVIEWS } from "../data/googleReviews";
import { buildOrganizationJsonLd, getPublicBusinessProfile } from "../lib/businessPublic";
import { withGoogleReviewsSchema } from "../lib/googleReviewsSchema";
import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";
import { HOME_PAGE_DESCRIPTION } from "./homeSeo";

/** Local business schema for homepage rich results. */
export function LocalBusinessJsonLd() {
  if (!hasPublicSiteOrigin()) return null;

  const profile = getPublicBusinessProfile();
  const organization = buildOrganizationJsonLd(profile, {
    pageUrl: absoluteUrl("/"),
    description: HOME_PAGE_DESCRIPTION,
    types: ["LocalBusiness", "AutomotiveBusiness", "FinancialService"]
  });

  const jsonLd = withGoogleReviewsSchema(organization, {
    summary: GOOGLE_REVIEWS_SUMMARY,
    reviews: HOME_FEATURED_REVIEWS
  });

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify({ "@context": "https://schema.org", ...jsonLd })}</script>
    </Helmet>
  );
}
