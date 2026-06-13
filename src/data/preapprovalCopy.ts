/** Marketing + SEO copy for /apply (single source of truth). */

export const SITE_CONTACT = {
  phoneDisplay: "(587) 415-7424",
  phoneTel: "+15874157424",
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
    "No credit check when you submit. If you authorize contact on the final step, we may run a soft inquiry — never a hard pull at this stage. A team member reviews your application and follows up; this is not an instant lender decision.",
  inventoryLink: "Browse inventory"
} as const;

export const PREAPPROVAL_WIZARD_INTRO = {
  title: "Tell us how we can help you",
  subline: "About 2 minutes · 5 quick questions"
} as const;

/** Short labels under wizard progress circles (order matches step index). */
export const PREAPPROVAL_WIZARD_STEPS = [
  { shortLabel: "Unit" },
  { shortLabel: "Details" },
  { shortLabel: "Income" },
  { shortLabel: "Credit" },
  { shortLabel: "Done" }
] as const;

export const PREAPPROVAL_CTA = {
  nextByStep: [
    "Continue to your details",
    "Continue to income",
    "Continue to credit estimate",
    "Continue to final details",
    "Submit application"
  ] as const,
  nextHintByStep: [
    "Pick a unit type and monthly budget to get started.",
    "We'll use this to follow up about your application.",
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
  if (step >= 3) return " — almost done";
  if (step >= 2) return " — you're doing great";
  if (step >= 1) return " — a few questions left";
  return "";
}

export const PREAPPROVAL_SUBMIT_LABEL = PREAPPROVAL_CTA.nextByStep[4];
export const PREAPPROVAL_SUBMITTING_LABEL = "Sending your application…";

export const PREAPPROVAL_COMPLETE = {
  title: "Application Complete!",
  lead: "A member of our team will be in touch with you shortly to help you find your dream ride."
} as const;

export const PREAPPROVAL_COMPLETE_SEO = {
  title: "Dream ride request received",
  description:
    "Thank you for your dream ride request with Temptation Motorsports. Our team will contact you shortly to help you find your next powersports unit."
} as const;

export const PREAPPROVAL_CONSENT_LABEL =
  "I authorize to be contacted by the financing team regarding this application.";

export const PREAPPROVAL_CONSENT_FOOTNOTE =
  "Submitting this does not trigger a hard credit pull. A team member will contact you — typically within the hour.";
