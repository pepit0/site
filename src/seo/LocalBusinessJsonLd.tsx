import { Helmet } from "react-helmet-async";
import { buildOrganizationJsonLd, getPublicBusinessProfile } from "../lib/businessPublic";
import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";
import { HOME_PAGE_DESCRIPTION } from "./homeSeo";

/** Local business schema for homepage rich results. */
export function LocalBusinessJsonLd() {
  if (!hasPublicSiteOrigin()) return null;

  const profile = getPublicBusinessProfile();
  const jsonLd = buildOrganizationJsonLd(profile, {
    pageUrl: absoluteUrl("/"),
    description: HOME_PAGE_DESCRIPTION,
    types: ["LocalBusiness", "AutomotiveBusiness", "FinancialService"]
  });

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}
