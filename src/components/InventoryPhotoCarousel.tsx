import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
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
  const [isLoading, setIsLoading] = useState(false);
  const [fillMinHeight, setFillMinHeight] = useState<number | undefined>();
  const [thumbsOverflow, setThumbsOverflow] = useState(false);
  const [canScrollThumbsLeft, setCanScrollThumbsLeft] = useState(false);
  const [canScrollThumbsRight, setCanScrollThumbsRight] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbsTrackRef = useRef<HTMLDivElement>(null);

  const count = photoPaths.length;
  const safeIndex = count > 0 ? ((photoIndex % count) + count) % count : 0;
  const currentPath = count > 0 ? photoPaths[safeIndex] : null;

  const captureFillHeight = useCallback(() => {
    const height = fillRef.current?.offsetHeight ?? 0;
    if (height > 40) setFillMinHeight(height);
  }, []);

  const handlePhotoLoad = useCallback(() => {
    setIsLoading(false);
    setFillMinHeight(undefined);
  }, []);

  useEffect(() => {
    if (variant !== "detail" || !currentPath) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const img = imgRef.current;
    if (img?.complete && img.naturalHeight > 0) {
      handlePhotoLoad();
    }
  }, [currentPath, handlePhotoLoad, variant]);

  const goPrev = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (count <= 1) return;
      if (variant === "detail") captureFillHeight();
      setPhotoIndex((i) => (i - 1 + count) % count);
    },
    [captureFillHeight, count, variant]
  );

  const goNext = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (count <= 1) return;
      if (variant === "detail") captureFillHeight();
      setPhotoIndex((i) => (i + 1) % count);
    },
    [captureFillHeight, count, variant]
  );

  const selectPhoto = useCallback(
    (index: number, e?: MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (count <= 0 || index === safeIndex) return;
      if (variant === "detail") captureFillHeight();
      setPhotoIndex(index);
    },
    [captureFillHeight, count, safeIndex, variant]
  );

  const updateThumbsScroll = useCallback(() => {
    const el = thumbsTrackRef.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth + 2;
    setThumbsOverflow(overflow);
    setCanScrollThumbsLeft(el.scrollLeft > 2);
    setCanScrollThumbsRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  const scrollThumbs = useCallback(
    (direction: -1 | 1, e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = thumbsTrackRef.current;
      if (!el) return;
      const amount = Math.max(140, el.clientWidth * 0.8) * direction;
      el.scrollBy({ left: amount, behavior: "smooth" });
    },
    []
  );

  useEffect(() => {
    setPhotoIndex(0);
  }, [photoPaths]);

  useEffect(() => {
    if (variant !== "detail" || count <= 1) return;
    updateThumbsScroll();
    const el = thumbsTrackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateThumbsScroll);
    ro.observe(el);
    el.addEventListener("scroll", updateThumbsScroll, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateThumbsScroll);
    };
  }, [count, photoPaths, updateThumbsScroll, variant]);

  useEffect(() => {
    if (variant !== "detail" || count <= 1) return;
    thumbsTrackRef.current
      ?.querySelector(`[data-thumb-index="${safeIndex}"]`)
      ?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [count, safeIndex, variant]);

  const showNav = count > 1;
  const showThumbStrip = variant === "detail" && count > 1;
  const variantClass = variant === "detail" ? "Detail" : "Card";
  const carouselClass = `inventory-photoCarousel inventory-photoCarousel${variantClass}${soldOverlay ? " inventory-photoCarouselSold" : ""}`;

  if (variant === "card") {
    return (
      <div className={carouselClass}>
        <div className="inventory-photoCarouselFill">
          {currentPath ? (
            <>
              <img
                key={currentPath}
                className="inventory-photoCarouselPhoto"
                src={inventoryPhotoPublicUrl(supabase, currentPath)}
                alt={alt}
                loading="lazy"
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
          </>
        ) : null}
      </div>
    );
  }

  const fillStyle =
    isLoading && fillMinHeight ? ({ minHeight: fillMinHeight } as const) : undefined;

  return (
    <div className="inventory-photoGallery inventory-photoGalleryDetail">
      <div className={carouselClass}>
        <div
          ref={fillRef}
          className={`inventory-photoCarouselFill${isLoading ? " inventory-photoCarouselFill--loading" : ""}`}
          style={fillStyle}
        >
          {currentPath ? (
            <>
              <img
                ref={imgRef}
                key={currentPath}
                className="inventory-photoCarouselPhoto"
                src={inventoryPhotoPublicUrl(supabase, currentPath)}
                alt={alt}
                loading="eager"
                onLoad={handlePhotoLoad}
              />
              <img className="inventory-photoWatermark" src={logoWatermark} alt="" aria-hidden />
              {isLoading ? (
                <span className="inventory-photoSpinner" role="status" aria-label="Loading photo" />
              ) : null}
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
            <span className="inventory-photoCounter" aria-live="polite">
              {safeIndex + 1} / {count}
            </span>
          </>
        ) : null}
      </div>

      {showThumbStrip ? (
        <div className="inventory-photoThumbs" aria-label="Photo gallery">
          {thumbsOverflow ? (
            <button
              type="button"
              className="inventory-photoThumbsNav inventory-photoThumbsNavPrev"
              aria-label="Scroll thumbnails back"
              disabled={!canScrollThumbsLeft}
              onClick={(e) => scrollThumbs(-1, e)}
            >
              ‹
            </button>
          ) : null}

          <div ref={thumbsTrackRef} className="inventory-photoThumbsTrack" role="tablist" aria-label="Choose photo">
            {photoPaths.map((path, index) => (
              <button
                key={path}
                type="button"
                role="tab"
                data-thumb-index={index}
                className={`inventory-photoThumb${index === safeIndex ? " inventory-photoThumbActive" : ""}`}
                aria-label={`Photo ${index + 1} of ${count}`}
                aria-selected={index === safeIndex}
                onClick={(e) => selectPhoto(index, e)}
              >
                <img
                  src={inventoryPhotoPublicUrl(supabase, path)}
                  alt={`${alt} — photo ${index + 1} of ${count}`}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              </button>
            ))}
          </div>

          {thumbsOverflow ? (
            <button
              type="button"
              className="inventory-photoThumbsNav inventory-photoThumbsNavNext"
              aria-label="Scroll thumbnails forward"
              disabled={!canScrollThumbsRight}
              onClick={(e) => scrollThumbs(1, e)}
            >
              ›
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
