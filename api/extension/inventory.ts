import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  isAuthorized,
  sendMethodNotAllowed,
  sendServerMisconfigured,
  sendUnauthorized
} from "./_lib/auth";
import { mapRowToExtensionVehicle, type InventoryUnitDbRow } from "./_lib/mapInventory";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";

const SELECT_COLUMNS =
  "id, year, make, model, odometer_km, cost, vin, photo_paths, status, posted_to_marketplace, marketplace_listed_at, marketplace_list_price";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
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

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    sendServerMisconfigured(res);
    return;
  }

  const { data, error } = await supabase
    .from("inventory_units")
    .select(SELECT_COLUMNS)
    .neq("status", "Unlisted")
    .order("updated_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const rows = (data ?? []) as InventoryUnitDbRow[];
  const vehicles = rows.map((row) => mapRowToExtensionVehicle(row, supabase));
  res.status(200).json(vehicles);
}
