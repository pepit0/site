import { Helmet } from "react-helmet-async";
import { PAYMENT_CALCULATOR_SEO } from "../data/paymentCalculatorCopy";
import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";

export function PaymentCalculatorPageJsonLd() {
  if (!hasPublicSiteOrigin()) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: PAYMENT_CALCULATOR_SEO.title,
    description: PAYMENT_CALCULATOR_SEO.description,
    url: absoluteUrl("/payment-calculator"),
    isPartOf: {
      "@type": "WebSite",
      name: "Temptation Motorsports",
      url: absoluteUrl("/")
    }
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}
