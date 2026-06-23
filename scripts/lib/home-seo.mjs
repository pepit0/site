/** Build-time homepage metadata for prerender. Keep in sync with src/seo/homeSeo.ts */

export const HOME_PRERENDER = {
  path: "/",
  title: "Powersports & motorsports financing Canada",
  description:
    "Powersports and motorsports financing for ATVs, motorcycles, snowmobiles, boats, autos, and more across Canada. Sherwood Park / Edmonton, Alberta. Good credit, bad credit, or no credit — apply free online.",
  h1: "Powersports and motorsports financing in Canada",
  intro:
    "Temptation Motorsports offers powersports financing and motorsports financing nationwide. We help with ATV, motorcycle, snowmobile, side-by-side, boat, jet ski, trailer, and auto loans from Sherwood Park near Edmonton, Alberta.",
  subIntro:
    "Good credit, bad credit, or no credit welcome. Free online application. Inventory and private-seller help across every province."
};

export const HOME_FINANCING_LINKS = [
  { path: "/financing", label: "Powersports financing hub" },
  { path: "/financing/atv-financing", label: "ATV financing" },
  { path: "/financing/motorcycle-financing", label: "Motorcycle financing" },
  { path: "/financing/snowmobile-financing", label: "Snowmobile financing" },
  { path: "/financing/boat-financing", label: "Boat financing" },
  { path: "/financing/auto-financing", label: "Auto financing" },
  { path: "/financing/powersports-financing-bad-credit", label: "Bad credit financing" },
  { path: "/financing/alberta", label: "Alberta financing" }
];

export function buildWebSiteJsonLd({ siteOrigin, description }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Temptation Motorsports",
    url: siteOrigin,
    description
  };
}
