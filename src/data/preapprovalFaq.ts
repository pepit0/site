export type PreapprovalFaqItem = {
  question: string;
  answer: string;
};

export const PREAPPROVAL_FAQ: PreapprovalFaqItem[] = [
  {
    question: "Can I get powersports financing with bad credit?",
    answer:
      "Often, yes. We work with riders across Canada who have decent, poor, or rebuilding credit. This free pre-approval helps us see what may be possible before a lender makes a final decision — we regularly help customers get riding their dream toy."
  },
  {
    question: "Do you run a credit check when I fill out this form?",
    answer:
      "Not to start. There is no credit check required to complete your free assessment. We only pull your consumer credit report if you opt in on the last step of the form. Otherwise we review what you submitted and contact you about next steps."
  },
  {
    question: "Will this pre-approval hurt my credit score?",
    answer:
      "Filling out this form does not require a credit pull unless you choose the optional consent at the end. If you leave that box unchecked, we won't pull your credit report at this stage."
  },
  {
    question: "How fast will I hear back after I apply?",
    answer:
      "Many riders hear from us within one business day — often sooner. The form only takes a few minutes. We'll reach out by phone to discuss financing options for motorcycles, snowmobiles, ATVs, and other powersports."
  },
  {
    question: "Can I finance a motorcycle or snowmobile with low credit in Canada?",
    answer:
      "We help Edmonton-area riders and customers nationwide. Whether you're after bike, sled, quad, or PWC financing, start here and tell us what you're looking for — we line up options for a wide range of credit situations."
  },
  {
    question: "Is this pre-approval a final approval?",
    answer:
      "No. Pre-approval lets us review your details and prepare options before we talk. The final decision happens with the lender and your full file."
  },
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
