import { Helmet } from "react-helmet-async";
import {
  optionalBusinessPostalCode,
  optionalBusinessStreetAddress,
  optionalSameAsUrls
} from "../lib/businessPublic";
import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";

/**
 * Rich result hint for local/dealer context. Skipped when VITE_PUBLIC_SITE_URL is unset
 * so we do not emit example.com markup in dev.
 */
export function LocalBusinessJsonLd() {
  if (!hasPublicSiteOrigin()) return null;

  const streetAddress = optionalBusinessStreetAddress();
  const postalCode = optionalBusinessPostalCode();
  const sameAs = optionalSameAsUrls();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MotorcycleDealer",
    name: "Temptation Motorsports",
    telephone: "+1-587-741-1945",
    url: absoluteUrl("/"),
    address: {
      "@type": "PostalAddress",
      ...(streetAddress ? { streetAddress } : {}),
      addressLocality: "Edmonton",
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
