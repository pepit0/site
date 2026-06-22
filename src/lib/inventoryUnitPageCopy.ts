import type { InventoryPublicRow } from "../data/inventory";
import { inventoryMakeModelTitle } from "../data/inventory";
import {
  formatInventoryPriceCad,
  inventoryPublicListPriceCad
} from "./inventoryPublicPrice";

function inventoryCategoryArticle(category: string): "a" | "an" {
  return /^[aeiou]/i.test(category.trim()) ? "an" : "a";
}

/** Unit-specific listing copy from public inventory fields only (no fabricated specs). */
export function buildInventoryUnitListingParagraphs(row: InventoryPublicRow): string[] {
  const ymm = `${row.year} ${inventoryMakeModelTitle(row)}`;
  const article = inventoryCategoryArticle(row.category);
  const paragraphs: string[] = [
    `This ${ymm} is listed in our inventory as ${article} ${row.category}. Stock number ${row.stock_number.trim()}.`
  ];

  if (row.odometer_km != null) {
    paragraphs.push(`The odometer reads ${row.odometer_km.toLocaleString("en-CA")} km.`);
  } else {
    paragraphs.push("Odometer is not listed for this unit yet.");
  }

  const listPrice = inventoryPublicListPriceCad(row);
  const priceSentence =
    listPrice != null
      ? `Listed at ${formatInventoryPriceCad(listPrice)}.`
      : "Pricing is by phone — call for a quote on this unit.";
  paragraphs.push(`It is marked ${row.status} on our site. ${priceSentence}`);

  const photoCount = row.photo_paths.length;
  if (photoCount > 0) {
    paragraphs.push(
      `This listing includes ${photoCount} photo${photoCount === 1 ? "" : "s"} of this unit.`
    );
  }

  return paragraphs;
}
