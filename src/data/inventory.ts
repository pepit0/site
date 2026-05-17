export type VehicleCategory =
  | "Motorcycle"
  | "ATV"
  | "Snowmobile"
  | "Side by side"
  | "Watercraft"
  | "Trailer";

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

/** Admin-only customer-unit / compliance fields on `inventory_units`. */
export type InventoryCustomerUnitFields = {
  vin: string | null;
  is_customer_unit: boolean;
  sell_ride_submission_id: string | null;
  has_registration: boolean | null;
  has_insurance: boolean | null;
  no_reg_insurance: boolean;
};

/** Full row for admins (`inventory_units`). */
export type InventoryUnitRow = Omit<InventoryPublicRow, "status"> &
  InventoryCustomerUnitFields & {
    status: InventoryStatus;
    cost: number;
    /** Admin-only; not on public listings or inventory_units_public. */
    admin_notes: string | null;
  };

export function inventoryComplianceLabel(row: Pick<InventoryCustomerUnitFields, "has_registration" | "has_insurance" | "no_reg_insurance">): string {
  if (row.no_reg_insurance) return "No reg/insurance";
  const parts: string[] = [];
  if (row.has_registration) parts.push("Reg");
  if (row.has_insurance) parts.push("Ins");
  return parts.length ? parts.join(", ") : "—";
}

export const VEHICLE_CATEGORIES: VehicleCategory[] = [
  "Motorcycle",
  "ATV",
  "Snowmobile",
  "Side by side",
  "Watercraft",
  "Trailer"
];

export const INVENTORY_PHOTOS_BUCKET = "inventory-photos" as const;

/** Shared copy on every public unit detail page (set once, redeploy). CTAs rendered in InventoryUnitDetailPage. */
export const INVENTORY_UNIT_DESCRIPTION = `Get Approved & Ride Regionally or Nationwide! 🏁

We finance all Motorsports, RVs, Marine, and Autos with $0 down options and delivery available across Canada. Whether you have pristine credit or need a subprime approval, our team gets it done.

No Down Payment? No problem.

Bad Credit? We accept all credit tiers.

Far Away? We deliver Canada-wide.`;

export function inventoryDisplayTitle(row: Pick<InventoryPublicRow, "make" | "model">): string {
  return `${row.make} ${row.model}`.trim();
}

/** Public catalog + listing pages — always shown in capitals regardless of DB casing. */
export function inventoryMakeModelTitle(row: Pick<InventoryPublicRow, "make" | "model">): string {
  return `${row.make} ${row.model}`.trim().toLocaleUpperCase("en-CA");
}

export function inventoryOdometerLabel(row: Pick<InventoryPublicRow, "odometer_km">): string {
  return row.odometer_km != null ? `${row.odometer_km.toLocaleString()} km` : "Kms TBD";
}

export function inventoryYearKmLine(row: Pick<InventoryPublicRow, "year" | "odometer_km">): string {
  return `${row.year} · ${inventoryOdometerLabel(row)}`;
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
  jetskis: "Watercraft",
  trailer: "Trailer",
  trailers: "Trailer",
  rv: "Trailer",
  rvs: "Trailer"
};

/** Reads `?category=` from inventory links (exact label or common slug). */
export function parseInventoryCategoryFromQuery(value: string | null | undefined): VehicleCategory | "all" {
  if (!value?.trim()) return "all";
  const raw = decodeURIComponent(value.trim());
  if (isVehicleCategory(raw)) return raw;
  return CATEGORY_QUERY_ALIASES[raw.toLowerCase()] ?? "all";
}

type InventoryCoreFields = Omit<InventoryPublicRow, "status"> & { status: InventoryStatus };

function parseInventoryCustomerFields(row: Record<string, unknown>): InventoryCustomerUnitFields {
  const vin = typeof row.vin === "string" ? row.vin : null;
  return {
    vin,
    is_customer_unit: row.is_customer_unit === true,
    sell_ride_submission_id:
      typeof row.sell_ride_submission_id === "string" ? row.sell_ride_submission_id : null,
    has_registration: row.has_registration === true ? true : row.has_registration === false ? false : null,
    has_insurance: row.has_insurance === true ? true : row.has_insurance === false ? false : null,
    no_reg_insurance: row.no_reg_insurance === true
  };
}

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
  const admin_notes = typeof r.admin_notes === "string" ? r.admin_notes : null;
  return { ...core, ...parseInventoryCustomerFields(r), cost: n, admin_notes };
}
