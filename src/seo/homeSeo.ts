/** Homepage SEO copy (title, description, OG). Keep in sync with scripts/lib/home-seo.mjs */

export const HOME_PAGE_TITLE = "Powersports & motorsports financing Canada";

export const HOME_PAGE_DESCRIPTION =
  "Powersports and motorsports financing for ATVs, motorcycles, snowmobiles, boats, autos, and more across Canada. Sherwood Park / Edmonton, Alberta. Good credit, bad credit, or no credit — apply free online.";

export const HOME_PAGE_OG_TYPE = "website";

export const HOME_SEO_INTRO = {
  heading: "Powersports and motorsports financing in Canada",
  body:
    "Temptation Motorsports offers powersports financing and motorsports financing nationwide. We help with ATV, motorcycle, snowmobile, side-by-side, boat, jet ski, trailer, and auto loans from our team in Sherwood Park near Edmonton, Alberta.",
  financingLinkLabel: "Browse financing options",
  applyLinkLabel: "Apply for financing"
} as const;

export function homeSlideAlt(label: string): string {
  return `${label} — Temptation Motorsports ride loans`;
}

export const HOME_SHOWROOM_BACKDROP_ALT =
  "Shop floor with rides for sale — Temptation Motorsports in Sherwood Park, Alberta";
