import { useCallback, useState, type MouseEvent } from "react";
import logoWatermark from "../assets/logo.png";
import type { VehicleCategory } from "../data/inventory";
import { inventoryPhotoPublicUrl } from "../lib/inventoryPhotos";
import { supabase } from "../lib/supabase";
import { InventoryPlaceholder } from "./InventoryPlaceholder";

export type InventoryPhotoCarouselProps = {
  photoPaths: string[];
  category: VehicleCategory;
  alt: string;
  variant?: "card" | "detail";
  soldOverlay?: boolean;
};

export function InventoryPhotoCarousel({
  photoPaths,
  category,
  alt,
  variant = "card",
  soldOverlay = false
}: InventoryPhotoCarouselProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const count = photoPaths.length;
  const safeIndex = count > 0 ? ((photoIndex % count) + count) % count : 0;
  const currentPath = count > 0 ? photoPaths[safeIndex] : null;

  const goPrev = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (count <= 1) return;
      setPhotoIndex((i) => (i - 1 + count) % count);
    },
    [count]
  );

  const goNext = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (count <= 1) return;
      setPhotoIndex((i) => (i + 1) % count);
    },
    [count]
  );

  const showNav = count > 1;
  const variantClass = variant === "detail" ? "Detail" : "Card";

  return (
    <div
      className={`inventory-photoCarousel inventory-photoCarousel${variantClass}${soldOverlay ? " inventory-photoCarouselSold" : ""}`}
    >
      <div className="inventory-photoCarouselFill">
        {currentPath ? (
          <>
            <img
              key={currentPath}
              className="inventory-photoCarouselPhoto"
              src={inventoryPhotoPublicUrl(supabase, currentPath)}
              alt={alt}
              loading={variant === "card" ? "lazy" : "eager"}
            />
            <img className="inventory-photoWatermark" src={logoWatermark} alt="" aria-hidden />
          </>
        ) : (
          <InventoryPlaceholder category={category} />
        )}
      </div>

      {soldOverlay ? (
        <span className="inventory-soldRibbon" aria-hidden>
          Sold
        </span>
      ) : null}

      {showNav ? (
        <>
          <button
            type="button"
            className="inventory-photoNav inventory-photoNavPrev"
            aria-label="Previous photo"
            onClick={goPrev}
          >
            ‹
          </button>
          <button
            type="button"
            className="inventory-photoNav inventory-photoNavNext"
            aria-label="Next photo"
            onClick={goNext}
          >
            ›
          </button>
          {variant === "detail" ? (
            <span className="inventory-photoCounter" aria-live="polite">
              {safeIndex + 1} / {count}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
