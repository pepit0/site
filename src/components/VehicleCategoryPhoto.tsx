import type { VehicleCategory } from "../data/inventory";
import {
  getVehicleCategoryPhotoSecondaryUrl,
  getVehicleCategoryPhotoUrl
} from "../lib/vehicleCategoryIcons";
import { vehicleCategoryAlt } from "../lib/vehicleCategoryAlt";

export type VehicleCategoryPhotoProps = {
  category: VehicleCategory;
  className?: string;
};

/** Full-color unit photo for pre-approval category buttons (not silhouette-styled). */
export function VehicleCategoryPhoto({ category, className }: VehicleCategoryPhotoProps) {
  const src = getVehicleCategoryPhotoUrl(category);
  const secondarySrc = getVehicleCategoryPhotoSecondaryUrl(category);
  const imgClass = ["vehicle-category-photo", className].filter(Boolean).join(" ");
  const alt = vehicleCategoryAlt(category);

  if (!src) {
    return null;
  }

  if (secondarySrc) {
    const pairClass = [
      "vehicle-category-photoPair",
      category === "Watercraft" ? "vehicle-category-photoPair--watercraft" : ""
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <span className={pairClass}>
        <img
          className={`${imgClass} vehicle-category-photo--primary`}
          src={src}
          alt={alt}
          decoding="async"
          loading="lazy"
        />
        <img
          className={`${imgClass} vehicle-category-photo--secondary`}
          src={secondarySrc}
          alt={alt}
          decoding="async"
          loading="lazy"
        />
      </span>
    );
  }

  return <img className={imgClass} src={src} alt={alt} decoding="async" loading="lazy" />;
}
