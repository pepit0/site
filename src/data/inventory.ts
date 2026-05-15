export type VehicleCategory =
  | "Motorcycle"
  | "ATV"
  | "Snowmobile"
  | "Side by side"
  | "Watercraft";

export const INVENTORY_STATUS_VALUES = ["Available", "Pending", "Sold", "Unlisted"] as const;

export type InventoryStatus = (typeof INVENTORY_STATUS_VALUES)[number];

/** Statuses exposed on the public site (view `inventory_units_public`). */
export const INVENTORY_PUBLIC_STATUS_VALUES = ["Available", "Pending", "Sold"] as const satisfies readonly InventoryStatus[];

export function isInventoryStatus(value: string): value is InventoryStatus {
  return (INVENTORY_STATUS_VALUES as readonly string[]).includes(value);
}

export type InventoryPublicStatus = (typeof INVENTORY_PUBLIC_STATUS_VALUES)[number];

export function isInventoryPublicStatus(value: string): value is InventoryPublicStatus {
  return (INVENTORY_PUBLIC_STATUS_VALUES as readonly string[]).includes(value);
}

/** CSS modifier for `.inventory-status*` pill (matches existing `Avail` / `Pending` class names). */
export function inventoryStatusPillModifier(status: InventoryStatus): "Avail" | "Pending" | "Sold" | "Unlisted" {
  switch (status) {
    case "Available":
      return "Avail";
    case "Pending":
      return "Pending";
    case "Sold":
      return "Sold";
    case "Unlisted":
      return "Unlisted";
  }
}

/** Row from `inventory_units_public` (no cost). */
export type InventoryPublicRow = {
  id: string;
  stock_number: string;
  year: number;
  make: string;
  model: string;
  odometer_km: number | null;
  category: VehicleCategory;
  status: InventoryPublicStatus;
  photo_paths: string[];
  created_at: string;
  updated_at: string;
};

/** Full row for admins (`inventory_units`). */
export type InventoryUnitRow = Omit<InventoryPublicRow, "status"> & {
  status: InventoryStatus;
  cost: number;
};

export const VEHICLE_CATEGORIES: VehicleCategory[] = [
  "Motorcycle",
  "ATV",
  "Snowmobile",
  "Side by side",
  "Watercraft"
];

export const INVENTORY_PHOTOS_BUCKET = "inventory-photos" as const;

export function inventoryDisplayTitle(row: Pick<InventoryPublicRow, "make" | "model">): string {
  return `${row.make} ${row.model}`.trim();
}

export function isVehicleCategory(value: string): value is VehicleCategory {
  return (VEHICLE_CATEGORIES as readonly string[]).includes(value);
}

const CATEGORY_QUERY_ALIASES: Record<string, VehicleCategory> = {
  motorcycle: "Motorcycle",
  motorcycles: "Motorcycle",
  atv: "ATV",
  atvs: "ATV",
  snowmobile: "Snowmobile",
  snowmobiles: "Snowmobile",
  "side-by-side": "Side by side",
  "side by side": "Side by side",
  sidebyside: "Side by side",
  watercraft: "Watercraft",
  jetski: "Watercraft",
  jetskis: "Watercraft"
};

/** Reads `?category=` from inventory links (exact label or common slug). */
export function parseInventoryCategoryFromQuery(value: string | null | undefined): VehicleCategory | "all" {
  if (!value?.trim()) return "all";
  const raw = decodeURIComponent(value.trim());
  if (isVehicleCategory(raw)) return raw;
  return CATEGORY_QUERY_ALIASES[raw.toLowerCase()] ?? "all";
}

type InventoryCoreFields = Omit<InventoryUnitRow, "cost">;

function parseInventoryCore(row: unknown): InventoryCoreFields | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = r.id;
  const stock_number = r.stock_number;
  const year = r.year;
  const make = r.make;
  const model = r.model;
  const category = r.category;
  const status = r.status;
  const created_at = r.created_at;
  const updated_at = r.updated_at;
  if (typeof id !== "string" || typeof stock_number !== "string") return null;
  if (typeof make !== "string" || typeof model !== "string") return null;
  if (typeof year !== "number" || !Number.isFinite(year)) return null;
  if (typeof category !== "string" || !isVehicleCategory(category)) return null;
  if (typeof status !== "string" || !isInventoryStatus(status)) return null;
  if (typeof created_at !== "string" || typeof updated_at !== "string") return null;
  const odometer_km =
    r.odometer_km == null
      ? null
      : (() => {
          const k =
            typeof r.odometer_km === "number"
              ? r.odometer_km
              : typeof r.odometer_km === "string"
                ? Number(r.odometer_km)
                : NaN;
          return Number.isFinite(k) && k >= 0 ? k : null;
        })();
  const rawPaths = r.photo_paths;
  const photo_paths = Array.isArray(rawPaths)
    ? rawPaths.filter((p): p is string => typeof p === "string")
    : [];
  return {
    id,
    stock_number,
    year,
    make,
    model,
    odometer_km,
    category,
    status,
    photo_paths,
    created_at,
    updated_at
  };
}

/** Parse a Supabase row from `inventory_units_public`. */
export function parseInventoryPublicRow(row: unknown): InventoryPublicRow | null {
  const core = parseInventoryCore(row);
  if (!core) return null;
  if (!isInventoryPublicStatus(core.status)) return null;
  return { ...core, status: core.status };
}

/** Parse full admin row from `inventory_units`. */
export function parseInventoryUnitRow(row: unknown): InventoryUnitRow | null {
  const core = parseInventoryCore(row);
  if (!core) return null;
  const r = row as Record<string, unknown>;
  const cost = r.cost;
  const n = typeof cost === "number" ? cost : typeof cost === "string" ? Number(cost) : NaN;
  if (!Number.isFinite(n)) return null;
  return { ...core, cost: n };
}
