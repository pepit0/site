import type { VehicleCategory } from "../data/inventory";
import { VehicleSilhouette } from "./VehicleSilhouette";

type InventoryPlaceholderProps = {
  category: VehicleCategory;
  className?: string;
};

export function InventoryPlaceholder({ category, className }: InventoryPlaceholderProps) {
  return (
    <div className={`inventory-placeholder${className ? ` ${className}` : ""}`}>
      <VehicleSilhouette category={category} />
      <span className="inventory-placeholderLabel">Coming soon</span>
    </div>
  );
}
