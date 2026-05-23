export type PreapprovalFaqItem = {
  question: string;
  answer: string;
};

export const PREAPPROVAL_FAQ: PreapprovalFaqItem[] = [
  {
    question: "Can I get powersports financing with good credit, bad credit, or no credit?",
    answer:
      "Yes — good credit, bad credit, or no credit, no problem. We help customers in all credit situations, from prime to subprime and rebuilding, get approved on their next ride — motorcycle, snowmobile, ATV, side-by-side, jet ski, boat, trailer, RV, and more. Fill out the free dream-ride request above and a specialist will contact you. With your consent on the form, we run a soft credit inquiry for pre-qualification that does not affect your score."
  },
  {
    question: "How does the dream ride request work?",
    answer:
      "Fill out the short form with what you're looking for — unit type, budget, and how to reach you. A Temptation Motorsports specialist reviews your details and contacts you by phone to help match you with inventory and financing options across Canada."
  },
  {
    question: "What if you don't have the unit I want in stock?",
    answer:
      "Our website shows what we have on hand right now — but that's only part of what we can access. We tap one of the largest powersports inventories across Canada, including dealer stock and private-sale units. Once we pre-qualify you, we can search for the year, make, and model you want, even if you don't see it listed on our inventory page. Tell us what you're after in the dream-ride request and we'll go to work."
  },
  {
    question: "Do you run a credit check when I fill out this form?",
    answer:
      "Only if you authorize it. When you check the consent box on the contact step, we may run a soft credit inquiry for pre-qualification. We do not run a hard credit pull at this stage. If you have questions before submitting, call us — we're happy to explain the process."
  },
  {
    question: "Will filling out this form hurt my credit score?",
    answer:
      "Completing the form alone does not pull your credit. If you check the authorization box, we run a soft inquiry for pre-qualification, which typically does not affect your credit score the way a hard inquiry can. We do not perform a hard credit pull when you submit this request."
  },
  {
    question: "Do you offer no money down financing?",
    answer:
      "We regularly help customers across Canada with no money down options, depending on the unit and program. Tell us what you're looking for in the form and we'll go over what's available when we call."
  },
  {
    question: "Do you ship powersports units across Canada?",
    answer:
      "Yes. We're based in Edmonton and work with riders nationwide. Many customers have their motorcycle, snowmobile, ATV, or other unit delivered straight to their doorstep — ask us about shipping when we reach out."
  },
  {
    question: "How fast will I hear back after I submit?",
    answer:
      "Many riders hear from us within one business day — often sooner. The form only takes a few minutes. We'll reach out by phone to discuss your dream ride and next steps."
  },
  {
    question: "What types of units can you help me finance?",
    answer:
      "Motorcycles and bikes, snowmobiles and sleds (new or used), ATVs, side-by-sides, jet skis and PWCs, boats, trailers, RVs, and more. Pick a category in the form or choose \"Not sure yet\" if you're still deciding."
  },
  {
    question: "Where are you based, and do you work outside Edmonton?",
    answer:
      "We're based in Edmonton, Alberta, and serve customers across Canada. Delivery and out-of-province purchases are common — we'll cover logistics when we contact you."
  }
];

export function preapprovalFaqJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PREAPPROVAL_FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };
}
