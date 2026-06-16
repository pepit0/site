import DOMPurify from "dompurify";

const BLOG_HTML_ALLOWED_TAGS = [
  "p",
  "h2",
  "h3",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "br",
  "a",
  "blockquote"
];

export function sanitizeBlogHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: BLOG_HTML_ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "target", "rel"]
  }).trim();
}

export function htmlToPlainText(html: string): string {
  if (!html.trim()) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function htmlToParagraphs(html: string): string[] {
  const sanitized = sanitizeBlogHtml(html);
  if (!sanitized) return [];

  const doc = new DOMParser().parseFromString(sanitized, "text/html");
  const blocks = doc.body.querySelectorAll("p, h2, h3, li, blockquote");

  if (blocks.length > 0) {
    return [...blocks]
      .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  const text = htmlToPlainText(sanitized);
  return text ? [text] : [];
}

export function buildExcerptFromHtml(html: string, max = 160): string {
  const text = htmlToParagraphs(html)[0] ?? htmlToPlainText(html);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function isBlogBodyHtmlEmpty(html: string): boolean {
  return htmlToPlainText(html).length === 0;
}
