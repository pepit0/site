import type { VehicleCategory } from "../data/inventory";
import { getVehicleCategoryPhotoUrl } from "../lib/vehicleCategoryIcons";

export type VehicleCategoryPhotoProps = {
  category: VehicleCategory;
  className?: string;
};

/** Full-color unit photo for pre-approval category buttons (not silhouette-styled). */
export function VehicleCategoryPhoto({ category, className }: VehicleCategoryPhotoProps) {
  const src = getVehicleCategoryPhotoUrl(category);
  const imgClass = ["vehicle-category-photo", className].filter(Boolean).join(" ");

  if (!src) {
    return null;
  }

  return <img className={imgClass} src={src} alt="" decoding="async" loading="lazy" />;
}
