import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const INVENTORY_PHOTOS_BUCKET = "inventory-photos";

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return cached;
}

export function inventoryPhotoPublicUrl(supabase: SupabaseClient, path: string): string {
  const { data } = supabase.storage.from(INVENTORY_PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
