import type { VehicleCategory } from "../data/inventory";
import {
  getVehicleCategoryPhotoSecondaryUrl,
  getVehicleCategoryPhotoUrl
} from "../lib/vehicleCategoryIcons";

export type VehicleCategoryPhotoProps = {
  category: VehicleCategory;
  className?: string;
};

/** Full-color unit photo for pre-approval category buttons (not silhouette-styled). */
export function VehicleCategoryPhoto({ category, className }: VehicleCategoryPhotoProps) {
  const src = getVehicleCategoryPhotoUrl(category);
  const secondarySrc = getVehicleCategoryPhotoSecondaryUrl(category);
  const imgClass = ["vehicle-category-photo", className].filter(Boolean).join(" ");

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
          alt=""
          decoding="async"
          loading="lazy"
        />
        <img
          className={`${imgClass} vehicle-category-photo--secondary`}
          src={secondarySrc}
          alt=""
          decoding="async"
          loading="lazy"
        />
      </span>
    );
  }

  return <img className={imgClass} src={src} alt="" decoding="async" loading="lazy" />;
}
