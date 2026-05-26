import type { VercelRequest, VercelResponse } from "@vercel/node";

export function getApiKeyFromRequest(req: VercelRequest): string | null {
  const header = req.headers["x-api-key"];
  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }
  if (Array.isArray(header) && typeof header[0] === "string" && header[0].trim()) {
    return header[0].trim();
  }
  return null;
}

export function isAuthorized(req: VercelRequest): boolean {
  const expected = process.env.EXTENSION_API_KEY;
  if (!expected) {
    return false;
  }
  const provided = getApiKeyFromRequest(req);
  return provided !== null && provided === expected;
}

export function sendUnauthorized(res: VercelResponse): void {
  res.status(401).json({ error: "Unauthorized" });
}

export function sendMethodNotAllowed(res: VercelResponse): void {
  res.status(405).json({ error: "Method not allowed" });
}

export function sendServerMisconfigured(res: VercelResponse): void {
  res.status(500).json({ error: "Server configuration error" });
}
