import type { VehicleCategory } from "../data/inventory";
import { getVehicleCategoryIconUrl } from "../lib/vehicleCategoryIcons";
import { vehicleCategoryAlt } from "../lib/vehicleCategoryAlt";

export type VehicleSilhouetteProps = {
  category: VehicleCategory;
  /** Extra classes on the root element (e.g. compact modifier). */
  className?: string;
};

export function VehicleSilhouette({ category, className }: VehicleSilhouetteProps) {
  const src = getVehicleCategoryIconUrl(category);
  const imgClass = ["inventory-placeholderSvg", "vehicle-category-icon", className].filter(Boolean).join(" ");

  if (!src) {
    return null;
  }

  return (
    <img className={imgClass} src={src} alt={vehicleCategoryAlt(category)} decoding="async" loading="lazy" />
  );
}
