import { Helmet } from "react-helmet-async";
import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";

export function SellRideApplyBreadcrumbJsonLd() {
  if (!hasPublicSiteOrigin()) return null;
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Sell your ride", item: absoluteUrl("/sell-your-ride") },
      {
        "@type": "ListItem",
        position: 3,
        name: "Apply",
        item: absoluteUrl("/sell-your-ride/apply")
      }
    ]
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(data)}</script>
    </Helmet>
  );
}
