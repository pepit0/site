/** Force https scheme for absolute URLs (avoids mixed-content in schema and OG). */
export function ensureHttpsUrl(url: string): string {
  return url.replace(/^http:\/\//i, "https://");
}
