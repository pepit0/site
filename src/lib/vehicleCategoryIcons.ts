import type { VehicleCategory } from "../data/inventory";
import { getHomeHeroLayerUrl } from "./homeHeroLayerUrls";

/** Inventory placeholder silhouettes (hero layer cutouts in `src/assets/`). */
const CATEGORY_ICON_FILES: Record<VehicleCategory, string> = {
  Motorcycle: "ATV_0000_Layer-9.png",
  ATV: "ATV_0003_Layer-1.png",
  Snowmobile: "ATV_0001_Layer-10.png",
  "Side by side": "ATV_0004_Layer-2.png",
  Watercraft: "jetski.png",
  Trailer: "ATV_0004_Layer-2.png"
};

/** Full-color category photos for pre-approval unit picker (`src/assets/`). */
const CATEGORY_PHOTO_FILES: Record<VehicleCategory, string | readonly string[]> = {
  Motorcycle: "ATV_0000_Layer-9.png",
  ATV: "ATV.png",
  Snowmobile: "ATV_0001_Layer-10.png",
  /** Prefer transparent PNG; JPG has a baked-in white background. */
  "Side by side": ["SIDE.png", "ATV_0004_Layer-2.png"],
  Watercraft: "boat.png",
  Trailer: "trailer.png"
};

/** Second unit shown beside the primary photo (slight overlap in UI). */
const CATEGORY_PHOTO_SECONDARY_FILES: Partial<Record<VehicleCategory, string>> = {
  Motorcycle: "ATV_0002_Layer-5.png",
  Watercraft: "jetski.png"
};

export function getVehicleCategoryIconUrl(category: VehicleCategory): string | undefined {
  return getHomeHeroLayerUrl(CATEGORY_ICON_FILES[category]);
}

export function getVehicleCategoryPhotoUrl(category: VehicleCategory): string | undefined {
  const entry = CATEGORY_PHOTO_FILES[category];
  const filenames = typeof entry === "string" ? [entry] : entry;
  for (const filename of filenames) {
    const url = getHomeHeroLayerUrl(filename);
    if (url) return url;
  }
  return undefined;
}

export function getVehicleCategoryPhotoSecondaryUrl(category: VehicleCategory): string | undefined {
  const filename = CATEGORY_PHOTO_SECONDARY_FILES[category];
  if (!filename) return undefined;
  return getHomeHeroLayerUrl(filename);
}
