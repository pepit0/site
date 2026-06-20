import { PREAPPROVAL_FAQ, type PreapprovalFaqItem } from "./preapprovalFaq";

export const SITE_FAQ_SEO = {
  title: "FAQ — financing, inventory & selling your ride",
  description:
    "Answers about powersports financing, bad credit loans, inventory, selling your ride, and how Temptation Motorsports helps buyers and sellers across Canada."
} as const;

export const SITE_FAQ_HERO = {
  h1: "Frequently asked questions",
  intro:
    "Quick answers about financing, our inventory, and selling your ride. Still stuck? Call us or use the contact page — we are happy to help."
} as const;

const SITE_FAQ_EXTRA: PreapprovalFaqItem[] = [
  {
    question: "How do I see what rides you have for sale?",
    answer:
      "Visit our inventory page to browse motorcycles, ATVs, snowmobiles, side-by-sides, jet skis, and trailers. Every listing shows photos and details. Call for pricing on any unit."
  },
  {
    question: "How does selling my ride through you work?",
    answer:
      "Tell us your price and send photos on the sell-your-ride form. We list your ride and find buyers across Canada. When a buyer gets a loan for your ride, you get a cheque for the full amount you asked for."
  },
  {
    question: "Where are you located?",
    answer:
      "We are based in Sherwood Park near Edmonton, Alberta. We help buyers and sellers all over Canada — many rides are shipped to the buyer's home."
  }
];

/** Site-wide FAQ (apply questions + general). */
export const SITE_FAQ: PreapprovalFaqItem[] = [...PREAPPROVAL_FAQ, ...SITE_FAQ_EXTRA];

export function siteFaqJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: SITE_FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };
}
