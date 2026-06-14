/** Marketing + SEO copy for /apply (single source of truth). */

export const SITE_CONTACT = {
  phoneDisplay: "(587) 415-7424",
  phoneTel: "+15874157424",
  email: "temptationmotorsports@gmail.com"
} as const;

export const PREAPPROVAL_SEO = {
  title: "Powersports financing application — all credit welcome",
  description:
    "Apply for ATV, motorcycle, and snowmobile financing in Canada. Edmonton-based. Good credit or bad credit — free online application. We call you to help."
} as const;

export const PREAPPROVAL_HERO = {
  eyebrow: "Find your ride",
  h1: "Your next ride is closer than you think.",
  creditLine: "Good credit? Bad credit? No credit? We can help.",
  lead:
    "We are in Edmonton. We help people all over Canada get a loan for their ride. Our team will call you to find the right ride and payment.",
  trustBullets: [
    "Free to apply",
    "We help all credit types",
    "We can ship to your home"
  ] as const,
  compliance:
    "We do not check your credit when you send the form. On the last step, you can say yes to a call from us. Then we may do a soft credit check. We never do a hard check at this step. A person on our team will call you. This is not an instant yes or no from a bank.",
  inventoryLink: "See our rides for sale"
} as const;

export const PREAPPROVAL_WIZARD_INTRO = {
  title: "Tell us what you need",
  subline: "About 2 minutes · 5 short steps"
} as const;

/** Short labels under wizard progress circles (order matches step index). */
export const PREAPPROVAL_WIZARD_STEPS = [
  { shortLabel: "Ride" },
  { shortLabel: "You" },
  { shortLabel: "Pay" },
  { shortLabel: "Credit" },
  { shortLabel: "Done" }
] as const;

export const PREAPPROVAL_CTA = {
  nextByStep: [
    "Next: about you",
    "Next: your pay",
    "Next: your credit",
    "Next: last step",
    "Send my application"
  ] as const,
  nextHintByStep: [
    "Pick a ride type and what you can pay each month.",
    "We use this to call you about your application.",
    "Your pay helps us see what works for you.",
    "Pick the credit range that fits best.",
    "Send it now. We will call you soon."
  ] as const,
  step0BlockedHint: "Pick a ride type above to go on.",
  submitHint: "We read your answers and call you to help you find your ride.",
  consentFootnote:
    "When you send this form, you are asking us to call you about a loan."
} as const;

export const PREAPPROVAL_CREDIT_STEP = {
  title: "About your credit",
  hint: "Good, bad, or no credit — all are OK. Pick what fits best. Or pick I'm not sure."
} as const;

/** Extra line on credit band buttons (value keys match PreApprovalPage CREDIT_BAND_OPTIONS). */
export const PREAPPROVAL_CREDIT_BAND_SUBTEXT: Partial<Record<string, string>> = {};

export const PREAPPROVAL_NAV_CTA = {
  default: "Apply now",
  resume: "Keep applying"
} as const;

export const PREAPPROVAL_FAQ_INTRO = "Got questions? Read below.";

/** Progress suffix from step index 2 onward. */
export function preapprovalProgressSuffix(step: number): string {
  if (step >= 3) return " — almost done";
  if (step >= 2) return " — nice work";
  if (step >= 1) return " — a few more";
  return "";
}

export const PREAPPROVAL_SUBMIT_LABEL = PREAPPROVAL_CTA.nextByStep[4];
export const PREAPPROVAL_SUBMITTING_LABEL = "Sending…";

export const PREAPPROVAL_COMPLETE = {
  title: "You are done!",
  lead: "Someone from our team will call you soon to help you find your ride."
} as const;

export const PREAPPROVAL_COMPLETE_SEO = {
  title: "We got your application",
  description:
    "Thanks for applying with Temptation Motorsports. Our team will call you soon to help you find your next ride."
} as const;

export const PREAPPROVAL_CONSENT_LABEL =
  "Yes — the loan team can call me about this application.";

export const PREAPPROVAL_CONSENT_FOOTNOTE =
  "Sending this form does not hurt your credit. Someone will call you — often within an hour.";
