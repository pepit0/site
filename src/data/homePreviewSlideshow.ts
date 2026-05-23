import bgRoad from "../assets/bgroad.png";
import bgTrail from "../assets/bgtrail.png";
import bgWater from "../assets/bgwater.png";

export type HomePreviewSlide = {
  id: string;
  src: string;
  label: string;
};

/** Top-of-page rotating backgrounds on /home-preview */
export const HOME_PREVIEW_SLIDESHOW: HomePreviewSlide[] = [
  { id: "water", src: bgWater, label: "Watercraft" },
  { id: "road", src: bgRoad, label: "On the road" },
  { id: "trail", src: bgTrail, label: "Trail and off-road" }
];

export const HOME_PREVIEW_SLIDESHOW_MS = 6000;
