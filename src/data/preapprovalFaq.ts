export type PreapprovalFaqItem = {
  question: string;
  answer: string;
};

export const PREAPPROVAL_FAQ: PreapprovalFaqItem[] = [
  {
    question: "Do you finance used snowmobiles and sleds?",
    answer:
      "Yes. We work with riders looking for sled and snowmobile financing, new or used, along with the rest of our powersports lineup."
  },
  {
    question: "Can I get financing for a motorcycle or bike?",
    answer:
      "Motorcycle and bike financing is a big part of what we do. Start with the pre-approval form and we'll go from there."
  },
  {
    question: "Do you handle ATV, side-by-side, and UTV loans?",
    answer:
      "We help with ATVs, side-by-sides, and UTVs. Pick the type that fits your ride when you apply, or choose \"Not sure yet\" if you're still deciding."
  },
  {
    question: "What about jet skis, PWCs, or boats?",
    answer:
      "We can often help with personal watercraft and marine units, depending on the deal. Mention what you're after in the application so we can line up the right options."
  },
  {
    question: "Is this pre-approval a final approval?",
    answer:
      "No. Pre-approval lets us review your details and prepare options before we talk. The final decision happens with the lender and your full file."
  },
  {
    question: "Where are you based, and do you work outside Edmonton?",
    answer:
      "We're based in Edmonton, Alberta. We work with customers across Canada. Ask us about delivery or out-of-province purchases when we reach out."
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
