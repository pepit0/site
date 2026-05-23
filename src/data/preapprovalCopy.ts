/** Marketing + SEO copy for /pre-approval (single source of truth). */

export const SITE_CONTACT = {
  phoneDisplay: "(587) 741-1945",
  phoneTel: "+15877411945",
  email: "temptationmotorsports@gmail.com"
} as const;

export const PREAPPROVAL_SEO = {
  title: "Powersports financing Canada — good & bad credit",
  description:
    "Dream ride financing from Edmonton, nationwide. Good credit, bad credit, or no credit — motorcycles, sleds, ATVs & more. No money down options, delivery to your door."
} as const;

export const PREAPPROVAL_HERO = {
  eyebrow: "Find your dream ride",
  h1: "Your next ride is closer than you think.",
  creditLine: "Good credit? Bad credit? No credit? No problem.",
  lead:
    "We're based in Edmonton and help Canadians coast to coast get financing on their dream ride — our team will contact you to match the right unit and payment.",
  trustBullets: [
    "100% free dream-ride request",
    "Prime, subprime, and rebuilding credit — we help all situations get approved on their next ride",
    "Nationwide delivery straight to your doorstep"
  ] as const,
  compliance:
    "Pre-qualification uses a soft credit inquiry that does not affect your score when you authorize it on the form — not a hard pull. A team member reviews your request and follows up; this is not an instant lender decision.",
  inventoryLink: "Browse inventory"
} as const;

export const PREAPPROVAL_WIZARD_INTRO = {
  title: "Tell us about your dream ride",
  subline: "About 2 minutes · 6 quick questions"
} as const;

export const PREAPPROVAL_CTA = {
  nextByStep: [
    "Choose unit & continue",
    "Set budget & continue",
    "Continue to income",
    "Continue to credit estimate",
    "Continue to your details",
    "Send my dream ride request"
  ] as const,
  nextHintByStep: [
    "Takes about 2 minutes — let's get started.",
    "Helps us match a monthly payment that fits your budget.",
    "A trade-in can change what you need to borrow.",
    "Income details help us understand what works for you.",
    "Any credit range is welcome — pick what feels closest.",
    "Submit now — a specialist from our team will contact you shortly."
  ] as const,
  step0BlockedHint: "Pick a unit type above to continue.",
  submitHint: "We'll review your answers and contact you to help find your dream ride.",
  consentFootnote:
    "Submitting this form requests that we contact you about financing options."
} as const;

export const PREAPPROVAL_CREDIT_STEP = {
  title: "Your credit estimate",
  hint: "Good, bad, or no credit — all situations welcome. Pick the range that feels closest, or choose I'm really not sure."
} as const;

/** Extra line on credit band buttons (value keys match PreApprovalPage CREDIT_BAND_OPTIONS). */
export const PREAPPROVAL_CREDIT_BAND_SUBTEXT: Partial<Record<string, string>> = {};

export const PREAPPROVAL_NAV_CTA = {
  default: "Find your dream ride",
  resume: "Continue application"
} as const;

export const PREAPPROVAL_FAQ_INTRO = "Have questions? Scroll down for answers.";

/** Progress suffix from step index 2 onward. */
export function preapprovalProgressSuffix(step: number): string {
  if (step >= 4) return " — almost done";
  if (step >= 3) return " — you're doing great";
  if (step >= 2) return " — a few questions left";
  return "";
}

export const PREAPPROVAL_SUBMIT_LABEL = PREAPPROVAL_CTA.nextByStep[5];
export const PREAPPROVAL_SUBMITTING_LABEL = "Sending your dream ride request…";

export const PREAPPROVAL_COMPLETE = {
  title: "You're on your way to your dream ride",
  lead: "Thanks for reaching out — someone from our team will contact you shortly.",
  body:
    "We help Canadians from coast to coast — prime, subprime, and every situation in between — get into the ride they've been waiting for. No money down options are available, and we ship nationwide straight to your doorstep.",
  contactIntro: "Want to talk sooner? Reach us directly:"
} as const;

export const PREAPPROVAL_COMPLETE_SEO = {
  title: "Dream ride request received",
  description:
    "Thank you for your dream ride request with Temptation Motorsports. Our team will contact you shortly to help you find your next powersports unit."
} as const;

export const PREAPPROVAL_CONSENT_SOFT_CHECK =
  "I agree to receive communications from Temptation Motorsports about my request by phone, text, or email, and I authorize a soft credit inquiry for pre-qualification that will not affect my credit score. I confirm the information above is accurate to the best of my knowledge.";
