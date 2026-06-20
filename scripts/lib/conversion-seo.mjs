/** Build-time metadata for /apply, /sell-your-ride, /faq prerender (keep in sync with src/data/*). */

export const CONVERSION_PRERENDER_PAGES = [
  {
    path: "/apply",
    title: "Powersports financing application — all credit welcome",
    description:
      "Apply for ATV, motorcycle, and snowmobile financing in Canada. Edmonton-based. Good credit or bad credit — free online application. We call you to help.",
    h1: "Apply for financing",
    intro:
      "Free online pre-approval for powersports and motorsports loans across Canada. Good credit, bad credit, or no credit — we help you find a ride and a payment."
  },
  {
    path: "/sell-your-ride",
    title: "Sell your ride",
    description:
      "Sell your bike, ATV, sled, or other ride from anywhere in Canada. Tell us your price. When a buyer gets a loan, you get a cheque for that full amount. No tricks. No hidden fees.",
    h1: "Sell your ride",
    intro:
      "Tell us the price you want. When a buyer gets a loan for your ride, you get a cheque for that full amount. We find buyers all over Canada."
  },
  {
    path: "/sell-your-ride/apply",
    title: "Sell your ride form",
    description:
      "Send us info about your bike, ATV, sled, or other ride. Add photos. We connect you with buyers who need a loan.",
    h1: "Sell your ride — application",
    intro: "Add your contact details, ride info, and at least three photos. We will call you to get started."
  },
  {
    path: "/faq",
    title: "FAQ — financing, inventory & selling your ride",
    description:
      "Answers about powersports financing, bad credit loans, inventory, selling your ride, and how Temptation Motorsports helps buyers and sellers across Canada.",
    h1: "Frequently asked questions",
    intro:
      "Quick answers about financing, our inventory, and selling your ride. Call us or contact us if you need more help."
  }
];

/** Subset for prerender FAQ body (matches src/data/faqCopy.ts). */
export const FAQ_PRERENDER_ITEMS = [
  {
    question: "Can I get a loan with good, bad, or no credit?",
    answer:
      "Yes. We help people with all types of credit for bikes, sleds, ATVs, side-by-sides, jet skis, boats, trailers, RVs, and more."
  },
  {
    question: "Do you ship rides all over Canada?",
    answer: "Yes. We are in Edmonton and work with riders all over Canada. Many rides are shipped to the buyer's home."
  },
  {
    question: "How do I see what rides you have for sale?",
    answer: "Visit our inventory page to browse listings with photos. Call for pricing on any unit."
  },
  {
    question: "How does selling my ride through you work?",
    answer:
      "Tell us your price and send photos. When a buyer gets a loan for your ride, you get a cheque for the full amount you asked for."
  }
];

export function buildFaqPageJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer }
    }))
  };
}
