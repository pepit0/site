/** Hero copy for /home-preview landing experiment */

export const HOME_PREVIEW_HERO = {
  /** Visible hero headline on the homepage */
  hook: "Ready to unlock your dream ride this summer?",
  /** In-document H1 for SEO (visually hidden; complements page title / meta) */
  seoH1: "Powersports and motorsports financing in Canada",
  /** One short line under the hook — keep it human, not keyword-stuffed */
  tagline: "Free to apply. No credit check until you say yes.",
  qualifyPrompt: "Start your application",
  qualifyAria: "Start your application for a ride loan",
  noCreditCheck: "(No credit check unless you say yes)",
  highlights: [
    { value: "2 min", label: "apply online" },
    { value: "all credit", label: "types welcome" },
    { value: "$0", label: "free to apply" }
  ] as const,
  inventoryLink: "See rides for sale"
} as const;
