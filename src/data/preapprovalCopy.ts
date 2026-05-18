/** Marketing + SEO copy for /pre-approval (single source of truth). */

export const PREAPPROVAL_SEO = {
  title: "Powersports financing pre-approval — bad credit welcome",
  description:
    "FREE credit assessment for motorcycle, snowmobile, ATV, and powersports loans in Canada. No credit check to start. See if you can get approved in minutes — Edmonton team, riders nationwide."
} as const;

export const PREAPPROVAL_HERO = {
  eyebrow: "Free credit assessment",
  h1: "Bad credit? You can still get approved.",
  lead:
    "Free assessment — we work with all credit situations. Start your application now and find out if you could be riding tomorrow.",
  trustBullets: ["100% free", "All credit situations welcome — we help riders get approved"] as const,
  compliance:
    "We do not pull your credit unless you opt in at the end (optional). This is a pre-qualification, not a final lender decision.",
  inventoryLink: "Browse inventory"
} as const;

export const PREAPPROVAL_WIZARD_INTRO = {
  title: "Start your free assessment",
  subline: "About 3 minutes · 7 quick questions",
  outcome: "Answer honestly — we'll see if you're likely to qualify."
} as const;

export const PREAPPROVAL_CTA = {
  nextByStep: [
    "Choose unit & continue",
    "Set budget & continue",
    "Continue to income",
    "Continue to credit estimate",
    "Continue to your details",
    "Continue to final step",
    "Get my approval answer"
  ] as const,
  nextHintByStep: [
    "Takes about 3 minutes — start now.",
    "Helps us match a monthly payment that fits your budget.",
    "A trade-in can change what you need to borrow.",
    "Income details let us assess what you may qualify for.",
    "A rough credit range is enough — no perfect score needed.",
    "We'll use this to follow up with your options.",
    "Submit now — we'll review your answers and contact you with realistic financing options."
  ] as const,
  step0BlockedHint: "Pick a unit type above to continue.",
  submitHint: "We'll review your answers and contact you with realistic options."
} as const;

export const PREAPPROVAL_CREDIT_STEP = {
  title: "Your credit estimate",
  hint: "Pick the range that feels closest — or choose I'm really not sure."
} as const;

/** Extra line on credit band buttons (value keys match PreApprovalPage CREDIT_BAND_OPTIONS). */
export const PREAPPROVAL_CREDIT_BAND_SUBTEXT: Partial<Record<string, string>> = {
  decent_550_619: "We help here often",
  poor_300_549: "You're welcome here",
  not_sure: "We can still help you out"
};

export const PREAPPROVAL_NAV_CTA = {
  default: "Get pre-approved",
  resume: "Continue application"
} as const;

/** Progress suffix from step index 2 onward. */
export function preapprovalProgressSuffix(step: number): string {
  if (step >= 5) return " — almost done";
  if (step >= 3) return " — you're doing great";
  if (step >= 2) return " — a few questions left";
  return "";
}

export const PREAPPROVAL_SUBMIT_LABEL = PREAPPROVAL_CTA.nextByStep[6];
export const PREAPPROVAL_SUBMITTING_LABEL = "Submitting your assessment…";

export const PREAPPROVAL_COMPLETE_LEGAL =
  "Based on what you told us — not a final approval from a lender.";

const COMPLETE_FOLLOW_UP =
  "We've received your pre-approval request. A team member will contact you shortly to discuss financing options and help you get closer to your dream ride.";

export const PREAPPROVAL_COMPLETE = {
  standard: {
    title: "You're on your way",
    lead: "Thanks for taking the time — we'll be in touch soon.",
    subtitle: COMPLETE_FOLLOW_UP
  },
  approved: {
    headline: "We can get you approved!",
    subline: "(based on what you told us)",
    title: "You're on your way",
    lead: "Thanks for taking the time — we'll be in touch soon.",
    subtitle: COMPLETE_FOLLOW_UP
  },
  conditional: {
    headline: "We can get you conditionally approved!",
    title: "You're on your way",
    lead: "Thanks for taking the time — we'll be in touch soon.",
    subtitle: COMPLETE_FOLLOW_UP
  }
} as const;
