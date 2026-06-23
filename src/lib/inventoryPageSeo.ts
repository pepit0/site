import type { InventoryBrowseCategory } from "../data/inventory";
import { isInventoryComingSoonCategory, isVehicleCategory } from "../data/inventory";
import { inventoryCategoryBrowseLabel } from "./inventoryRoutes";

export function inventoryPageSeoMeta(
  category: InventoryBrowseCategory,
  searchQuery: string
): { title: string; description: string; noindex?: boolean } {
  const q = searchQuery.trim();
  if (q) {
    return {
      title: "Search inventory",
      description:
        "Search motorcycles, ATVs, snowmobiles, side-by-sides, watercraft, and trailers at Temptation Motorsports. Call for pricing. Financing available across Canada.",
      noindex: true
    };
  }

  if (category === "all") {
    return {
      title: "Rides for sale",
      description:
        "See bikes, ATVs, sleds, side-by-sides, jet skis, and trailers in Edmonton. Call for price on every ride. Apply for a loan with Temptation Motorsports."
    };
  }

  if (isInventoryComingSoonCategory(category)) {
    return {
      title: "Autos coming soon",
      description:
        "Cars and trucks are coming soon to Temptation Motorsports inventory. Browse powersports listings now or apply for auto financing across Canada.",
      noindex: true
    };
  }

  if (!isVehicleCategory(category)) {
    return {
      title: "Rides for sale",
      description:
        "See bikes, ATVs, sleds, side-by-sides, jet skis, and trailers in Edmonton. Call for price on every ride. Apply for a loan with Temptation Motorsports.",
      noindex: true
    };
  }

  const label = inventoryCategoryBrowseLabel(category);
  return {
    title: label,
    description: `Browse ${label.toLowerCase()} at Temptation Motorsports in Edmonton. Call for pricing on every unit. Financing and shipping available across Canada.`,
    noindex: true
  };
}
