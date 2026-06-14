import { Helmet } from "react-helmet-async";
import {
  optionalBusinessPostalCode,
  optionalBusinessStreetAddress
} from "../lib/businessPublic";
import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";

type FinancialServiceJsonLdProps = {
  serviceName: string;
  description: string;
  path: string;
};

export function FinancialServiceJsonLd({ serviceName, description, path }: FinancialServiceJsonLdProps) {
  if (!hasPublicSiteOrigin()) return null;

  const streetAddress = optionalBusinessStreetAddress();
  const postalCode = optionalBusinessPostalCode();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FinancialService",
    name: `Temptation Motorsports ${serviceName}`,
    description,
    url: absoluteUrl(path),
    telephone: "+1-587-415-7424",
    parentOrganization: {
      "@type": "Organization",
      name: "Temptation Motorsports",
      url: absoluteUrl("/")
    },
    areaServed: {
      "@type": "Country",
      name: "Canada"
    },
    address: {
      "@type": "PostalAddress",
      ...(streetAddress ? { streetAddress } : {}),
      addressLocality: "Sherwood Park",
      addressRegion: "AB",
      addressCountry: "CA",
      ...(postalCode ? { postalCode } : {})
    }
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}
