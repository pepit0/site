import type { VehicleCategory } from "../data/inventory";
import { getHomeHeroLayerUrl } from "./homeHeroLayerUrls";

/** Pre-approval + inventory placeholder icons (files in `src/assets/`). */
const CATEGORY_ICON_FILES: Record<VehicleCategory, string> = {
  Motorcycle: "ATV_0000_Layer-9.png",
  ATV: "ATV_0003_Layer-1.png",
  Snowmobile: "ATV_0001_Layer-10.png",
  "Side by side": "ATV_0004_Layer-2.png",
  Watercraft: "jetski.png",
  Trailer: "ATV_0004_Layer-2.png"
};

export function getVehicleCategoryIconUrl(category: VehicleCategory): string | undefined {
  return getHomeHeroLayerUrl(CATEGORY_ICON_FILES[category]);
}
