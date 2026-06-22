import { BLOG_HUB_SEO } from "./blog-seo.mjs";
import { FINANCING_PRERENDER_PAGES } from "./financing-seo.mjs";

/** Keep in sync with src/data/inventory.ts VEHICLE_CATEGORIES */
const VEHICLE_CATEGORIES = ["Motorcycle", "ATV", "Snowmobile", "Side by side", "Watercraft", "Trailer"];

/** Keep in sync with src/lib/inventoryRoutes.ts inventoryCategoryBrowseLabel */
function inventoryCategoryBrowseLabel(category) {
  switch (category) {
    case "Motorcycle":
      return "Motorcycles for sale";
    case "ATV":
      return "ATVs for sale";
    case "Snowmobile":
      return "Snowmobiles for sale";
    case "Side by side":
      return "Side-by-sides for sale";
    case "Watercraft":
      return "Watercraft for sale";
    case "Trailer":
      return "Trailers for sale";
    default:
      return `${category} for sale`;
  }
}

function inventoryCategoryHref(category) {
  return `/inventory?category=${encodeURIComponent(category)}`;
}

function absoluteUrl(origin, path) {
  const base = origin.replace(/\/+$/, "");
  const loc = path.startsWith("/") ? path : `/${path}`;
  return `${base}${loc}`;
}

function linkItem(title, url, description) {
  return `- [${title}](${url}): ${description}`;
}

function section(heading, items) {
  if (items.length === 0) return "";
  return `## ${heading}\n\n${items.join("\n")}\n`;
}

/**
 * Build llms.txt Markdown (https://llmstxt.org/).
 * @param {{ origin: string; businessProfile: ReturnType<import("./business-public.mjs").loadPublicBusinessProfile>; blogPosts: { path: string; title: string; description: string }[] }} options
 */
export function buildLlmsTxt({ origin, businessProfile, blogPosts }) {
  const name = businessProfile.name || "Temptation Motorsports";
  const cityLine = [businessProfile.city, businessProfile.regionCode].filter(Boolean).join(", ");

  const shopItems = [
    linkItem(
      "Inventory",
      absoluteUrl(origin, "/inventory"),
      "Browse motorcycles, ATVs, snowmobiles, side-by-sides, watercraft, and trailers for sale across Canada."
    ),
    linkItem(
      "Apply for financing",
      absoluteUrl(origin, "/apply"),
      "Free online pre-approval application for powersports, marine, trailer, and auto loans."
    ),
    linkItem(
      "Sell your ride",
      absoluteUrl(origin, "/sell-your-ride"),
      "Submit your vehicle to list with Temptation Motorsports."
    ),
    ...VEHICLE_CATEGORIES.map((category) =>
      linkItem(
        inventoryCategoryBrowseLabel(category),
        absoluteUrl(origin, inventoryCategoryHref(category)),
        `Browse ${category.toLowerCase()} listings in our inventory.`
      )
    )
  ];

  const financingItems = FINANCING_PRERENDER_PAGES.map((page) =>
    linkItem(page.h1 || page.title, absoluteUrl(origin, page.path), page.description)
  );

  const companyItems = [
    linkItem(
      "About",
      absoluteUrl(origin, "/about"),
      "Learn about Temptation Motorsports, our team, and how we help buyers across Canada."
    ),
    linkItem(
      "Customer reviews",
      absoluteUrl(origin, "/reviews"),
      "Google reviews and ratings from Temptation Motorsports customers."
    ),
    linkItem(
      "Contact",
      absoluteUrl(origin, "/contact"),
      "Phone, email, hours, and location for Temptation Motorsports in Sherwood Park, Alberta."
    ),
    linkItem(
      "FAQ",
      absoluteUrl(origin, "/faq"),
      "Frequently asked questions about financing, inventory, and buying from Temptation Motorsports."
    )
  ];

  const optionalItems = [
    linkItem(
      BLOG_HUB_SEO.h1 || BLOG_HUB_SEO.title,
      absoluteUrl(origin, BLOG_HUB_SEO.path),
      BLOG_HUB_SEO.description
    ),
    linkItem(
      "Payment calculator",
      absoluteUrl(origin, "/payment-calculator"),
      "Estimate monthly payments for powersports and vehicle financing."
    ),
    linkItem(
      "Sell your ride application",
      absoluteUrl(origin, "/sell-your-ride/apply"),
      "Start the sell-your-ride intake form."
    ),
    ...blogPosts.map((post) => linkItem(post.title, absoluteUrl(origin, post.path), post.description))
  ];

  const summary =
    "Temptation Motorsports is an Edmonton-area powersports dealer and financing broker helping Canadians buy and finance motorcycles, ATVs, snowmobiles, side-by-sides, watercraft, trailers, and more — good, bad, or no credit.";

  const contactParts = [
    `Call or text ${businessProfile.phoneDisplay}`,
    `email ${businessProfile.email}`,
    cityLine ? `based in ${cityLine}` : null,
    "serving buyers across Canada with financing and shipping"
  ].filter(Boolean);

  const body =
    `${name} lists used powersports and recreation vehicles online. Inventory pricing is typically call-for-price. ` +
    `Contact: ${contactParts.join("; ")}. ` +
    `Machine-readable sitemap: ${absoluteUrl(origin, "/sitemap.xml")}.`;

  return [
    `# ${name}`,
    "",
    `> ${summary}`,
    "",
    body,
    "",
    section("Shop", shopItems),
    section("Financing", financingItems),
    section("Company", companyItems),
    section("Optional", optionalItems)
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
    .concat("\n");
}
