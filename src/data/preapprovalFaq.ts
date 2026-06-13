export type PreapprovalFaqItem = {
  question: string;
  answer: string;
};

export const PREAPPROVAL_FAQ: PreapprovalFaqItem[] = [
  {
    question: "Can I get a loan with good, bad, or no credit?",
    answer:
      "Yes. We help people with all types of credit. That means bikes, sleds, ATVs, side-by-sides, jet skis, boats, trailers, RVs, and more. Fill out the free form above. We will call you. If you say yes on the form, we may do a soft credit check. It does not hurt your score."
  },
  {
    question: "How does the form work?",
    answer:
      "Fill out the short form. Tell us what ride you want, what you can pay, and how to reach you. We read it and call you to help you find a ride and a loan."
  },
  {
    question: "What if you do not have the ride I want?",
    answer:
      "Our website shows what we have now. But we can find more rides all over Canada. After you apply, we can look for the year, make, and model you want. Tell us in the form. We will look for you."
  },
  {
    question: "Do you check my credit when I fill this out?",
    answer:
      "Only if you say yes. When you check the box on the last step, we may do a soft credit check. We do not do a hard check now. Call us if you have questions. We are happy to explain."
  },
  {
    question: "Will this form hurt my credit score?",
    answer:
      "Just filling out the form does not check your credit. If you check the yes box, we may do a soft check. That usually does not hurt your score like a hard check can. We do not do a hard check when you send this form."
  },
  {
    question: "Can I buy with no money down?",
    answer:
      "Often yes. It depends on the ride and the loan. Tell us what you want in the form. We will tell you what is open when we call."
  },
  {
    question: "Do you ship rides all over Canada?",
    answer:
      "Yes. We are in Edmonton. We work with riders all over Canada. Many people get their bike, sled, or ATV shipped to their home. Ask us about shipping when we call."
  },
  {
    question: "How fast will you call me?",
    answer:
      "Many people hear from us in one business day. Often sooner. The form takes a few minutes. We call you to talk about your ride and next steps."
  },
  {
    question: "What kinds of rides can you help me buy?",
    answer:
      "Motorcycles, snowmobiles, ATVs, side-by-sides, jet skis, boats, trailers, RVs, and more. Pick one in the form. Or pick Not sure yet if you are still thinking."
  },
  {
    question: "Where are you? Do you work outside Edmonton?",
    answer:
      "We are in Edmonton, Alberta. We help people all over Canada. Many buyers live far away. We can ship. We will talk about that when we call."
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
