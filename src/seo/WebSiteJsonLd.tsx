import { Helmet } from "react-helmet-async";
import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";
import { HOME_PAGE_DESCRIPTION } from "./homeSeo";

/** WebSite schema for homepage discoverability and inventory search. */
export function WebSiteJsonLd() {
  if (!hasPublicSiteOrigin()) return null;

  const origin = absoluteUrl("/").replace(/\/$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Temptation Motorsports",
    url: origin,
    description: HOME_PAGE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin}/inventory?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}
