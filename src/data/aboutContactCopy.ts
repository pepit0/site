/** About and Contact page copy (single source of truth). */

import { SITE_CONTACT } from "./preapprovalCopy";

export const ABOUT_SEO = {
  title: "About Temptation Motorsports",
  description:
    "Temptation Motorsports offers powersports and motorsports financing plus rides for sale across Canada. ATVs, motorcycles, sleds, boats, and more. Based in Sherwood Park near Edmonton."
} as const;

export const ABOUT_HERO = {
  h1: "About Temptation Motorsports",
  tagline: "Powersports and motorsports financing plus rides for sale, from Alberta to every province.",
  intro: [
    "Temptation Motorsports is a team in Sherwood Park near Edmonton, Alberta. We help people all over Canada pay for the rides they want and find units that fit their budget.",
    "We are not a faceless online form. A real person reads your application and calls you back. That is how we have built trust with buyers from BC to Ontario and everywhere between."
  ]
} as const;

export const ABOUT_SECTIONS = [
  {
    heading: "What we do",
    body:
      "We help with powersports financing and motorsports financing for ATVs, motorcycles, snowmobiles, side-by-sides, boats, jet skis, trailers, and autos. We also list rides for sale and help private sellers connect with buyers who need a loan."
  },
  {
    heading: "Who we help",
    body:
      "Good credit, bad credit, and no credit buyers are all welcome on the free application. Farm buyers, weekend riders, and families looking for a side-by-side all talk to the same team."
  },
  {
    heading: "Where we serve",
    body:
      "Our home base is Alberta, but most of our deals ship or register outside the province. British Columbia, Saskatchewan, and Ontario buyers work with us every week."
  }
] as const;

export const CONTACT_SEO = {
  title: "Contact Temptation Motorsports",
  description:
    "Call or email Temptation Motorsports in Sherwood Park, Alberta. Questions about financing, inventory, or selling your ride. We help buyers across Canada."
} as const;

export const CONTACT_HERO = {
  h1: "Contact us",
  tagline: "Call, email, or apply online. We usually reply within one business day.",
  intro: [
    "Have a question before you apply? Want help with a unit in our inventory? Reach us by phone or email. For financing, the fastest start is still the free online form."
  ]
} as const;

export const CONTACT_REASONS = [
  {
    title: "Financing help",
    body: "Questions about ATV, boat, auto, or other financing. Use the free online form or call us to talk through your file.",
    linkLabel: "Apply for financing",
    linkTo: "/apply"
  },
  {
    title: "Inventory",
    body: "Ask about a ride listed on our site, pricing, or shipping to your province.",
    linkLabel: "Browse inventory",
    linkTo: "/inventory"
  },
  {
    title: "Sell your ride",
    body: "Private sellers who want buyers with financing can list with us.",
    linkLabel: "Sell your ride",
    linkTo: "/sell-your-ride"
  },
  {
    title: "Financing guides",
    body: "Read our topic pages for ATV, motorcycle, BC, Alberta, and other financing questions.",
    linkLabel: "Financing topics",
    linkTo: "/financing"
  }
] as const;

export function contactMailtoHref(): string {
  return `mailto:${SITE_CONTACT.email}`;
}
