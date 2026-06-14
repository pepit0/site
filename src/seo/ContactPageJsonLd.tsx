import { Helmet } from "react-helmet-async";
import { buildOrganizationJsonLd, getPublicBusinessProfile } from "../lib/businessPublic";
import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";
import { CONTACT_SEO } from "../data/aboutContactCopy";

export function ContactPageJsonLd() {
  if (!hasPublicSiteOrigin()) return null;

  const profile = getPublicBusinessProfile();
  const organization = buildOrganizationJsonLd(profile, {
    pageUrl: absoluteUrl("/"),
    description: CONTACT_SEO.description,
    types: ["Organization", "AutomotiveBusiness", "FinancialService"]
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: CONTACT_SEO.title,
    description: CONTACT_SEO.description,
    url: absoluteUrl("/contact"),
    mainEntity: organization
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}
