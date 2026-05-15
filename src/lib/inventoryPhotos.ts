import type { SupabaseClient } from "@supabase/supabase-js";
import { INVENTORY_PHOTOS_BUCKET } from "../data/inventory";

export function inventoryPhotoPublicUrl(client: SupabaseClient, path: string): string {
  const { data } = client.storage.from(INVENTORY_PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
