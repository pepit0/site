import { Helmet } from "react-helmet-async";
import {
  optionalBusinessPostalCode,
  optionalBusinessStreetAddress,
  optionalSameAsUrls
} from "../lib/businessPublic";
import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";
import { HOME_PAGE_DESCRIPTION } from "./homeSeo";

/**
 * Local + automotive business schema for homepage rich results.
 * Skipped when VITE_PUBLIC_SITE_URL is unset so dev does not emit example.com markup.
 */
export function LocalBusinessJsonLd() {
  if (!hasPublicSiteOrigin()) return null;

  const streetAddress = optionalBusinessStreetAddress();
  const postalCode = optionalBusinessPostalCode();
  const sameAs = optionalSameAsUrls();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "AutomotiveBusiness"],
    name: "Temptation Motorsports",
    description: HOME_PAGE_DESCRIPTION,
    telephone: "+1-587-415-7424",
    url: absoluteUrl("/"),
    address: {
      "@type": "PostalAddress",
      ...(streetAddress ? { streetAddress } : {}),
      addressLocality: "Sherwood Park",
      addressRegion: "AB",
      addressCountry: "CA",
      ...(postalCode ? { postalCode } : {})
    },
    areaServed: {
      "@type": "Country",
      name: "Canada"
    },
    ...(sameAs.length > 0 ? { sameAs } : {})
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}
