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
