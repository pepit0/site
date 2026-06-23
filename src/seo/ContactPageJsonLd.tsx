import { Helmet } from "react-helmet-async";
import { buildOrganizationJsonLd, getPublicBusinessProfile } from "../lib/businessPublic";
import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";
import { CONTACT_SEO } from "../data/aboutContactCopy";

export function ContactPageJsonLd() {
  if (!hasPublicSiteOrigin()) return null;

  const profile = getPublicBusinessProfile();
  const pageUrl = absoluteUrl("/contact");
  const orgId = `${pageUrl}#organization`;
  const organization = buildOrganizationJsonLd(profile, {
    pageUrl: absoluteUrl("/"),
    description: CONTACT_SEO.description,
    types: ["Organization", "AutomotiveBusiness", "FinancialService"]
  });
  const { "@context": _ctx, ...orgBase } = organization;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ContactPage",
        name: CONTACT_SEO.title,
        description: CONTACT_SEO.description,
        url: pageUrl,
        mainEntity: { "@id": orgId }
      },
      { ...orgBase, "@id": orgId }
    ]
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}
