import type { InventoryBrowseCategory, VehicleCategory } from "../data/inventory";

export function inventoryCategoryHref(category: Exclude<InventoryBrowseCategory, "all">): string {
  return `/inventory?category=${encodeURIComponent(category)}`;
}

export function inventoryMakeSearchHref(make: string): string {
  return `/inventory?q=${encodeURIComponent(make)}`;
}

/** Footer / browse link label, e.g. "Motorcycles for sale". */
export function inventoryCategoryBrowseLabel(category: VehicleCategory): string {
  switch (category) {
    case "Motorcycle":
      return "Motorcycles for sale";
    case "ATV":
      return "ATVs for sale";
    case "Snowmobile":
      return "Snowmobiles for sale";
    case "Side by side":
      return "Side-by-sides for sale";
    case "Watercraft":
      return "Watercraft for sale";
    case "Trailer":
      return "Trailers for sale";
  }
}

export const INVENTORY_POPULAR_BRANDS = ["Yamaha", "Polaris", "Honda", "Can-Am"] as const;
