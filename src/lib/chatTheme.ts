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
 * Why Bob ignores unitinterest in the desktop app
 * -----------------------------------------------
 * Tawk AI Assist does NOT read visitor custom fields from the sidebar (unitinterest, unitdetails, etc.).
 * Those fields are for human agents only. FAQs only help when the visitor’s question closely matches the FAQ text —
 * they are not tied to profile attributes. Triggers cannot insert custom-attribute values into messages (feature gap).
 *
 * What works: text in the live chat thread (visitor or agent messages), crawled website pages, and shortcuts/FAQs.
 * Our site copies a pre-filled visitor message to the clipboard when they pick a unit; they paste once in Tawk.
 */

/**
 * Optional add-on (do NOT replace Bob’s full Base Prompt if Tawk warns you).
 * Paste under AI Assist → Knowledge / Additional instructions / Custom training — wherever Tawk allows a short add-on.
 */
export const TAWK_AI_ADDON_INSTRUCTION = `Website visitors often complete intake before chat. If their first message mentions a stock number or listing URL, use that as their selected unit. Never say you cannot see their unit when they already sent year/make/model/stock or a temptmotorsports.com/inventory/ link. For price or financing, offer pre-approval or callback at (587) 415-7424.`;

/** Legacy full prompt — use TAWK_AI_ADDON_INSTRUCTION instead of replacing Base Prompt when possible. */
export const TAWK_AI_UNIT_CONTEXT_PROMPT = TAWK_AI_ADDON_INSTRUCTION;

/** FAQ backup — still requires the visitor to mention the unit in chat; profile fields alone will not trigger it. */
export const TAWK_FAQ_SELECTED_UNIT = {
  question: "Visitor asks for details on the unit they chose on the website (stock number or listing link in their message)",
  answer:
    "Use the year, make, model, stock number, and listing URL from their chat message. Summarize availability and mileage if they included it. For price or financing, direct to pre-approval at temptmotorsports.com/pre-approval or a callback — do not claim you cannot see their unit when they already named it."
};

/**
 * Optional Tawk trigger (static message — cannot pull unitdetails from attributes):
 * Run when Visitor starts a chat AND Page URL contains /inventory/
 * Action: Send message — "I see you're on a listing page. Tell me what you'd like to know about this unit."
 */
export const TAWK_AUTOMATION_UNIT_EVENT = "website-unit-selected";
