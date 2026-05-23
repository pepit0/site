export type PreapprovalFaqItem = {
  question: string;
  answer: string;
};

export const PREAPPROVAL_FAQ: PreapprovalFaqItem[] = [
  {
    question: "Can I get powersports financing with good credit, bad credit, or no credit?",
    answer:
      "Yes — good credit, bad credit, or no credit, no problem. We help customers in all credit situations, from prime to subprime and rebuilding, get approved on their next ride — motorcycle, snowmobile, ATV, side-by-side, jet ski, boat, trailer, RV, and more. Fill out the free dream-ride request above and a specialist will contact you. We only pull your credit if you opt in on the last step."
  },
  {
    question: "How does the dream ride request work?",
    answer:
      "Fill out the short form with what you're looking for — unit type, budget, and how to reach you. A Temptation Motorsports specialist reviews your details and contacts you by phone to help match you with inventory and financing options across Canada."
  },
  {
    question: "Do you run a credit check when I fill out this form?",
    answer:
      "Not to start. There is no credit check required to complete your request. We only pull your consumer credit report if you opt in on the last step. Otherwise we review what you submitted and contact you about next steps."
  },
  {
    question: "Will filling out this form hurt my credit score?",
    answer:
      "Completing the form does not require a credit pull unless you choose the optional consent at the end. If you leave that box unchecked, we won't pull your credit report at this stage."
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

export function preapprovalFaqJsonLd() {
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
