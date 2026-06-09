import bgRoad from "../assets/bgroad.png";
import bgTrail from "../assets/bgtrail.png";
import bgWater from "../assets/bgwater.png";

export type HomePreviewSlide = {
  id: string;
  src: string;
  label: string;
  /** object-position on mobile portrait hero — keeps rider + unit in frame */
  mobileObjectPosition: string;
};

/** Top-of-page rotating backgrounds on /home-preview */
export const HOME_PREVIEW_SLIDESHOW: HomePreviewSlide[] = [
  { id: "water", src: bgWater, label: "Watercraft", mobileObjectPosition: "30% 54%" },
  { id: "road", src: bgRoad, label: "On the road", mobileObjectPosition: "41% 58%" },
  { id: "trail", src: bgTrail, label: "Trail and off-road", mobileObjectPosition: "30% 52%" }
];

export const HOME_PREVIEW_SLIDESHOW_MS = 6000;
