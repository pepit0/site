import { Helmet } from "react-helmet-async";
import { ABOUT_SEO } from "../data/aboutContactCopy";
import { buildOrganizationJsonLd, getPublicBusinessProfile } from "../lib/businessPublic";
import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";

export function AboutPageJsonLd() {
  if (!hasPublicSiteOrigin()) return null;

  const profile = getPublicBusinessProfile();
  const organization = buildOrganizationJsonLd(profile, {
    pageUrl: absoluteUrl("/"),
    description: ABOUT_SEO.description,
    types: ["Organization", "AutomotiveBusiness"]
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: ABOUT_SEO.title,
    description: ABOUT_SEO.description,
    url: absoluteUrl("/about"),
    mainEntity: organization
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}
