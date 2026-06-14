/** Blog posts (single source of truth). Add new posts to the top of BLOG_POSTS. */

import bgRoad from "../assets/bgroad.png";
import bgTrail from "../assets/bgtrail.png";
import bgWater from "../assets/bgwater.png";

export type BlogPost = {
  slug: string;
  title: string;
  seoDescription: string;
  publishedAt: string;
  thumbnail: string;
  thumbnailAlt: string;
  excerpt: string;
  body: readonly string[];
};

export const BLOG_HUB_SEO = {
  title: "Blog",
  description:
    "News and tips from Temptation Motorsports. Powersports and motorsports financing help, buying advice, and updates for ATV, motorcycle, snowmobile, and powersports buyers across Canada."
} as const;

export const BLOG_HUB = {
  h1: "Blog",
  tagline: "Latest news and tips for riders across Canada."
} as const;

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "atv-financing-bad-credit-canada",
    title: "ATV financing with bad credit in Canada",
    seoDescription:
      "Can you get ATV financing with bad credit in Canada? Plain answers on what lenders look at, how to apply, and what to expect from Temptation Motorsports.",
    publishedAt: "2026-06-01",
    thumbnail: bgTrail,
    thumbnailAlt: "ATV on a trail",
    excerpt: "Bad credit does not always mean no. Here is how ATV financing works when your score is not perfect.",
    body: [
      "Many riders think bad credit means an instant no. That is not always true. Lenders look at your whole picture, not just one number.",
      "We see buyers with past bumps who still get approved. A steady job, a fair down payment, and a ride that fits your budget all help.",
      "Start with our free online form. Tell us what you want and what you can pay each month. A person on our team calls you. We explain options in plain words.",
      "We do not run a hard credit check on the first form. You stay in control. If you want to move ahead, we walk you through the next step.",
      "Ready to see what is possible? Apply free or call us. We help buyers in Alberta and every province."
    ]
  },
  {
    slug: "buy-used-snowmobile-alberta",
    title: "What to check before you buy a used snowmobile in Alberta",
    seoDescription:
      "Buying a used snowmobile in Alberta? A simple checklist for mileage, track, storage, and financing before you sign.",
    publishedAt: "2026-05-15",
    thumbnail: bgRoad,
    thumbnailAlt: "Snowmobile on a winter trail",
    excerpt: "A quick checklist before you buy a used sled in Alberta or ship one from out of province.",
    body: [
      "Used sleds can be a great deal if you know what to look for. Start with the basics before you fall in love with the paint.",
      "Check the track, skis, and suspension. Ask how it was stored in summer. A dry garage beats sitting outside in the rain.",
      "Get the VIN and ask about service records. A seller who can show oil changes and belt swaps is worth trusting more.",
      "Plan your budget with tax and fees in mind. Our payment calculator on this site includes dealer fees and provincial tax so you are not surprised later.",
      "Need a loan for the sled? Our team helps with snowmobile financing across Canada. Apply free and we will call you back."
    ]
  },
  {
    slug: "monthly-vs-biweekly-payments",
    title: "Monthly vs bi-weekly payments: what riders should know",
    seoDescription:
      "Should you pay monthly or bi-weekly on a powersports loan? Simple math and tips from Temptation Motorsports in Edmonton.",
    publishedAt: "2026-05-01",
    thumbnail: bgWater,
    thumbnailAlt: "Jet ski on the water",
    excerpt: "Bi-weekly payments can match your pay cheque. Here is how they compare to monthly on a ride loan.",
    body: [
      "Most loans show a monthly payment. Many jobs pay every two weeks. Bi-weekly can line up with your pay cycle.",
      "Bi-weekly does not always mean half a monthly payment. You make 26 payments in a year, not 24. That can pay the loan down a bit faster.",
      "Use our site calculator to flip between monthly and bi-weekly on the same price and term. Fees and tax are already in the estimate.",
      "The right choice depends on your budget and how you get paid. There is no single answer for everyone.",
      "Questions about a real quote? Apply free or contact us. We are in Sherwood Park near Edmonton and help buyers nationwide."
    ]
  }
];

export function getBlogPostBySlug(slug: string | undefined): BlogPost | undefined {
  if (!slug) return undefined;
  return BLOG_POSTS.find((post) => post.slug === slug);
}

/** @deprecated Use fetchPublicBlogPosts from lib/blogPostsApi */
export function blogPostsNewestFirst(): BlogPost[] {
  return [...BLOG_POSTS].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function formatBlogDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(year, month - 1, day));
}
