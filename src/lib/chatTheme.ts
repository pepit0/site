/**
 * Shared chat branding — matches :root tokens in src/index.css.
 * Paste hex values into tawk.to → Administration → Channels → Chat Widget → Appearance (Advanced).
 */
export const CHAT_THEME = {
  bg: "#0c0d10",
  bgElevated: "#12141a",
  surface: "#181b22",
  surfaceHover: "#1e222c",
  border: "#2a2f3a",
  text: "#e8eaef",
  textMuted: "#9aa3b2",
  accent: "#f05d22",
  accentHover: "#ff7a3d",
  accentMuted: "rgba(240, 93, 34, 0.18)",
  fontFamily: '"DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
} as const;

/** Map site tokens → Tawk dashboard fields (labels vary slightly by Tawk version). */
export const TAWK_WIDGET_APPEARANCE = [
  { site: "Header background", hex: CHAT_THEME.surface },
  { site: "Header text", hex: CHAT_THEME.text },
  { site: "Chat / window background", hex: CHAT_THEME.bgElevated },
  { site: "Primary button / accent", hex: CHAT_THEME.accent },
  { site: "Button hover (if available)", hex: CHAT_THEME.accentHover },
  { site: "Visitor message bubble background", hex: CHAT_THEME.surfaceHover },
  { site: "Visitor message text", hex: CHAT_THEME.text },
  { site: "Agent message bubble background", hex: CHAT_THEME.accent },
  { site: "Agent message text", hex: "#ffffff" },
  { site: "Muted / secondary text", hex: CHAT_THEME.textMuted }
] as const;

/** Milliseconds to keep intake panel visible while fading before Tawk opens. */
export const CHAT_HANDOFF_FADE_MS = 340;

/**
 * Paste into Tawk → AI Assist → your agent → Base Prompt (replace or append to existing instructions).
 * Required: without this, the bot ignores visitor profile fields even when they appear in the dashboard.
 */
export const TAWK_AI_UNIT_CONTEXT_PROMPT = `CRITICAL — Website intake before chat

Many visitors complete our site intake before chatting. Their visitor profile (visible to you in the sidebar) includes custom fields such as:
- unitinterest / unit-interest
- unitdetails / unit-details (year, make, model, category, status, km, stock #, listing URL)
- stocknumber / stock-number
- unitid / unit-id
- listingurl / unit-url
- Display name may show "First Last · Stock #MSF-XXXX"

When unitinterest OR unitdetails OR stocknumber is populated:
1. The visitor ALREADY selected that unit. NEVER say you do not have access or ask them to repeat the stock number.
2. Read unitdetails (or unitinterest) and answer using those facts: year, make, model, category, mileage, availability status, stock number.
3. Share the listingurl so they can view photos on the site.
4. We do not put price in these fields — for price, payment, or financing, offer pre-approval at temptmotorsports.com/pre-approval or a callback from our team at (587) 741-1945.
5. If they ask "details on the unit I chose", summarize from unitdetails — do not deflect.

Only ask which unit they want if ALL unit fields are empty.`;

/** FAQ answer to add under AI Assist → Data Sources → FAQs (optional backup). */
export const TAWK_FAQ_SELECTED_UNIT = {
  question:
    "Visitor asks about the unit they chose on the website before chat (unitinterest, unitdetails, stocknumber in profile)",
  answer:
    "Read unitdetails and unitinterest from the visitor profile. Summarize year, make, model, category, km, status, and stock number. Give them the listingurl. For price or financing, direct to pre-approval or a phone callback — never claim you cannot see their selected unit."
};

/**
 * Tawk Automation (optional): trigger on event "website-unit-selected" → AI sends first message in thread.
 */
export const TAWK_AUTOMATION_UNIT_EVENT = "website-unit-selected";
