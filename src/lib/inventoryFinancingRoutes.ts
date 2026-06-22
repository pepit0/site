import type { VehicleCategory } from "../data/inventory";

const CATEGORY_FINANCING_PATHS: Record<VehicleCategory, string> = {
  Motorcycle: "/financing/motorcycle-financing",
  ATV: "/financing/atv-financing",
  Snowmobile: "/financing/snowmobile-financing",
  "Side by side": "/financing/side-by-side-financing",
  Watercraft: "/financing/jet-ski-financing",
  Trailer: "/financing/trailer-financing"
};

const CATEGORY_FINANCING_LABELS: Record<VehicleCategory, string> = {
  Motorcycle: "Motorcycle financing",
  ATV: "ATV financing",
  Snowmobile: "Snowmobile financing",
  "Side by side": "Side-by-side financing",
  Watercraft: "Jet ski financing",
  Trailer: "Trailer financing"
};

export function financingPathForCategory(category: VehicleCategory): string {
  return CATEGORY_FINANCING_PATHS[category];
}

export function financingNavLabelForCategory(category: VehicleCategory): string {
  return CATEGORY_FINANCING_LABELS[category];
}
