/**
 * Hero glow on `background.png` (2000×1123). Each `layerFile` is a trimmed Photoshop export;
 * `placement` positions the glow on the photo. `unitName` is the sidebar label.
 * `inventoryCategory` is the inventory page filter when the row is clicked.
 */

import type { VehicleCategory } from "./inventory";

export const HERO_BACKGROUND_SIZE = { width: 2000, height: 1123 } as const;

export type HomeHeroPlacement = {
  top: string;
  left: string;
  width: string;
  height: string;
};

export type HomeHeroHotspot = {
  id: string;
  unitName: string;
  /** Inventory filter (`inventory_units_public.category`) */
  inventoryCategory: VehicleCategory;
  /** Omit for sidebar-only rows (no hero glow). */
  layerFile?: string;
  placement?: HomeHeroPlacement;
  /** Sidebar list order (low → high) */
  sidebarOrder: number;
};

export const HOME_HERO_HOTSPOTS: HomeHeroHotspot[] = [
  {
    id: "layer-9",
    unitName: "Sport Bikes",
    inventoryCategory: "Motorcycle",
    layerFile: "ATV_0000_Layer-9.png",
    sidebarOrder: 1,
    placement: { left: "66%", top: "46.3%", width: "28.1%", height: "33.13%" }
  },
  {
    id: "layer-10",
    unitName: "Snowmobiles",
    inventoryCategory: "Snowmobile",
    layerFile: "ATV_0001_Layer-10.png",
    sidebarOrder: 2,
    placement: { left: "43%", top: "48.8%", width: "36.4%", height: "33.13%" }
  },
  {
    id: "layer-5",
    unitName: "Offroad bikes",
    inventoryCategory: "Motorcycle",
    layerFile: "ATV_0002_Layer-5.png",
    sidebarOrder: 3,
    placement: { left: "39%", top: "42.39%", width: "26.05%", height: "38.2%" }
  },
  {
    id: "layer-1",
    unitName: "ATVs",
    inventoryCategory: "ATV",
    layerFile: "ATV_0003_Layer-1.png",
    sidebarOrder: 4,
    placement: { left: "24.4%", top: "45.59%", width: "26.7%", height: "33.75%" }
  },
  {
    id: "layer-2",
    unitName: "Side by Sides",
    inventoryCategory: "Side by side",
    layerFile: "ATV_0004_Layer-2.png",
    sidebarOrder: 5,
    placement: { left: "7.4%", top: "33.84%", width: "30.35%", height: "41.76%" }
  },
  {
    id: "layer-11",
    unitName: "Jetskis",
    inventoryCategory: "Watercraft",
    layerFile: "ATV_0005_Layer-11.png",
    sidebarOrder: 6,
    placement: { left: "50%", top: "35.26%", width: "39.1%", height: "30.28%" }
  },
  {
    id: "layer-7",
    unitName: "Watercraft",
    inventoryCategory: "Watercraft",
    layerFile: "ATV_0006_Layer-7.png",
    sidebarOrder: 7,
    placement: { left: "23.2%", top: "24.93%", width: "51.25%", height: "32.06%" }
  },
  {
    id: "trailers-rvs",
    unitName: "Trailers & RVs",
    inventoryCategory: "Trailer",
    sidebarOrder: 8
  }
];

export function homeHeroHotspotsForSidebar(): HomeHeroHotspot[] {
  return [...HOME_HERO_HOTSPOTS].sort((a, b) => a.sidebarOrder - b.sidebarOrder);
}
