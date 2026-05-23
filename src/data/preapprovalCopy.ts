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
    "We do not pull your credit unless you opt in at the last step (optional). A team member will review your request and contact you — not an instant lender decision.",
  inventoryLink: "Browse inventory"
} as const;

export const PREAPPROVAL_WIZARD_INTRO = {
  title: "Tell us about your dream ride",
  subline: "About 3 minutes · 7 quick questions",
  outcome: "Pick a unit type below to get started."
} as const;

export const PREAPPROVAL_CTA = {
  nextByStep: [
    "Choose unit & continue",
    "Set budget & continue",
    "Continue to income",
    "Continue to credit estimate",
    "Continue to your details",
    "Continue to final step",
    "Send my dream ride request"
  ] as const,
  nextHintByStep: [
    "Takes about 3 minutes — let's get started.",
    "Helps us match a monthly payment that fits your budget.",
    "A trade-in can change what you need to borrow.",
    "Income details help us understand what works for you.",
    "Any credit range is welcome — pick what feels closest.",
    "We'll use this to reach out with options for your dream ride.",
    "Submit now — a specialist from our team will contact you shortly."
  ] as const,
  step0BlockedHint: "Pick a unit type above to continue.",
  submitHint: "We'll review your answers and contact you to help find your dream ride."
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
  if (step >= 5) return " — almost done";
  if (step >= 3) return " — you're doing great";
  if (step >= 2) return " — a few questions left";
  return "";
}

export const PREAPPROVAL_SUBMIT_LABEL = PREAPPROVAL_CTA.nextByStep[6];
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

export const PREAPPROVAL_CONSENT_CONTACT =
  "I confirm the information above is accurate to the best of my knowledge and I agree to be contacted by Temptation Motorsports to help me find my dream ride.";
