import type { SupabaseClient } from "@supabase/supabase-js";
import { SELL_RIDE_PHOTOS_BUCKET } from "../data/sellRide";

export function sellRidePhotoPublicUrl(client: SupabaseClient, path: string): string {
  const { data } = client.storage.from(SELL_RIDE_PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
