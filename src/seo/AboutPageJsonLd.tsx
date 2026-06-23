import { Helmet } from "react-helmet-async";
import { ABOUT_SEO } from "../data/aboutContactCopy";
import { buildOrganizationJsonLd, getPublicBusinessProfile } from "../lib/businessPublic";
import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";

export function AboutPageJsonLd() {
  if (!hasPublicSiteOrigin()) return null;

  const profile = getPublicBusinessProfile();
  const pageUrl = absoluteUrl("/about");
  const orgId = `${pageUrl}#organization`;
  const organization = buildOrganizationJsonLd(profile, {
    pageUrl: absoluteUrl("/"),
    description: ABOUT_SEO.description,
    types: ["Organization", "AutomotiveBusiness"]
  });
  const { "@context": _ctx, ...orgBase } = organization;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        name: ABOUT_SEO.title,
        description: ABOUT_SEO.description,
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
