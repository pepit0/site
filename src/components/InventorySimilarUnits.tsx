import { Link } from "react-router-dom";
import type { InventoryPublicRow, VehicleCategory } from "../data/inventory";
import { inventoryCategoryBrowseLabel, inventoryCategoryHref } from "../lib/inventoryRoutes";
import { InventoryUnitCard } from "./InventoryUnitCard";

export type InventorySimilarUnitsProps = {
  current: InventoryPublicRow;
  units: InventoryPublicRow[];
};

export function InventorySimilarUnits({ current, units }: InventorySimilarUnitsProps) {
  if (units.length === 0) return null;

  const category = current.category as VehicleCategory;

  return (
    <section className="inventory-similar" aria-labelledby="inventory-similar-heading">
      <div className="inventory-similarHeader">
        <h2 id="inventory-similar-heading" className="inventory-similarTitle">
          You might also like
        </h2>
        <Link to={inventoryCategoryHref(category)} className="inventory-similarBrowseLink">
          {inventoryCategoryBrowseLabel(category)}
        </Link>
      </div>
      <ul className="inventory-similarGrid">
        {units.map((item) => (
          <li key={item.id}>
            <InventoryUnitCard item={item} fromCategory={category} />
          </li>
        ))}
      </ul>
    </section>
  );
}
