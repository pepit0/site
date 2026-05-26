import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  isAuthorized,
  sendMethodNotAllowed,
  sendServerMisconfigured,
  sendUnauthorized
} from "../../_lib/auth.js";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin.js";

type PatchBody = {
  posted?: boolean;
  listedAt?: string;
};

function parseId(req: VercelRequest): string | null {
  const raw = req.query.id;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].trim()) {
    return raw[0].trim();
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "PATCH") {
    sendMethodNotAllowed(res);
    return;
  }

  if (!process.env.EXTENSION_API_KEY) {
    sendServerMisconfigured(res);
    return;
  }

  if (!isAuthorized(req)) {
    sendUnauthorized(res);
    return;
  }

  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: "Missing inventory unit id" });
    return;
  }

  const body = (typeof req.body === "object" && req.body !== null ? req.body : {}) as PatchBody;
  if (body.posted !== true) {
    res.status(400).json({ error: "Body must include posted: true" });
    return;
  }

  const listedAt =
    typeof body.listedAt === "string" && body.listedAt.trim()
      ? body.listedAt.trim()
      : new Date().toISOString();

  const listedDate = new Date(listedAt);
  if (Number.isNaN(listedDate.getTime())) {
    res.status(400).json({ error: "Invalid listedAt date" });
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    sendServerMisconfigured(res);
    return;
  }

  const { data, error } = await supabase
    .from("inventory_units")
    .update({
      posted_to_marketplace: true,
      marketplace_listed_at: listedDate.toISOString()
    })
    .eq("id", id)
    .select("id, posted_to_marketplace, marketplace_listed_at")
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!data) {
    res.status(404).json({ error: "Inventory unit not found" });
    return;
  }

  res.status(200).json({
    ok: true,
    id: data.id,
    posted_to_marketplace: data.posted_to_marketplace,
    marketplace_listed_at: data.marketplace_listed_at
  });
}
