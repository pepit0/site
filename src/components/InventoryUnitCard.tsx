import { Link } from "react-router-dom";
import {
  inventoryMakeModelTitle,
  inventoryStatusPillModifier,
  inventoryYearKmLine,
  type InventoryPublicRow,
  type VehicleCategory
} from "../data/inventory";
import { InventoryPhotoCarousel } from "./InventoryPhotoCarousel";

export type InventoryUnitCardProps = {
  item: InventoryPublicRow;
  fromCategory?: VehicleCategory | "all";
};

export function InventoryUnitCard({ item, fromCategory = "all" }: InventoryUnitCardProps) {
  const title = inventoryMakeModelTitle(item);
  const detailTo =
    fromCategory !== "all"
      ? { pathname: `/inventory/${item.id}`, state: { fromCategory } }
      : `/inventory/${item.id}`;

  return (
    <article className="inventory-card">
      <InventoryPhotoCarousel
        photoPaths={item.photo_paths}
        category={item.category}
        alt={`${title} photo`}
        variant="card"
        soldOverlay={item.status === "Sold"}
      />
      <Link to={detailTo} className="inventory-cardLink">
        <p className="inventory-cardMeta">
          <span className="inventory-cardCategory">{item.category}</span>
          <span className={`inventory-status inventory-status${inventoryStatusPillModifier(item.status)}`}>
            {item.status}
          </span>
        </p>
        <h2 className="inventory-cardTitle">{title}</h2>
        <p className="inventory-cardYearKm">{inventoryYearKmLine(item)}</p>
        <p className="inventory-cardStock">Stock #{item.stock_number}</p>
      </Link>
    </article>
  );
}
