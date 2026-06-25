/** Hero copy for /home-preview landing experiment */



export const HOME_PREVIEW_HERO = {

  /** Rotating lead phrase at the start of the homepage H1 */

  hookLeads: ["Bad credit?", "No credit?", "Rebuilding credit?"] as const,

  /** Static remainder of the homepage H1 (follows the rotating lead) */

  hookRest: " Don't worry about it.",

  /** In-document H1 for SEO (visually hidden; complements page title / meta) */

  seoH1: "Powersports and motorsports financing in Sherwood Park, Alberta",

  /** One short line under the hook — keep it human, not keyword-stuffed */

  tagline: "Life happens, we get it. We help Canadians just like you get approved, regardless of credit situation.",

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

