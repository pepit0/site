import {
  inventoryDisplayTitle,
  inventoryYearKmLine,
  isVehicleCategory,
  parseInventoryPublicRow,
  type InventoryPublicRow,
  type VehicleCategory
} from "../data/inventory";
import { absoluteUrl } from "./siteUrl";
import { supabase } from "./supabase";

export type ChatSuggestedUnit = {
  id: string;
  stock_number: string;
  year: number;
  make: string;
  model: string;
  category: VehicleCategory;
  status: InventoryPublicRow["status"];
  title: string;
  yearKm: string;
  href: string;
};

export type ChatSuggestParams = {
  category?: VehicleCategory | null;
  yearMin?: number | null;
  yearMax?: number | null;
  queryText?: string;
  limit?: number;
};

type FeaturedUnitJson = {
  id: string;
  stock_number: string;
  year: number;
  make: string;
  model: string;
  category: string;
};

/** One-line facts for Tawk visitor profile (agents) and the opening chat message (AI Assist). */
export function buildUnitDetailsForTawk(unit: ChatSuggestedUnit): string {
  return [
    `${unit.year} ${unit.make} ${unit.model}`,
    unit.category,
    unit.status,
    unit.yearKm.replace(" · ", ", "),
    `Stock #${unit.stock_number}`,
    unit.href
  ].join(" | ");
}

/** Message visitors paste/send in Tawk — this is what AI Assist actually reads. */
export function buildTawkVisitorOpeningMessage(unit: ChatSuggestedUnit): string {
  return `I'm interested in this unit from your website: ${buildUnitDetailsForTawk(unit)}. Can you help with details?`;
}

export function inventoryRowToChatSuggested(row: InventoryPublicRow): ChatSuggestedUnit {
  return {
    id: row.id,
    stock_number: row.stock_number,
    year: row.year,
    make: row.make,
    model: row.model,
    category: row.category,
    status: row.status,
    title: inventoryDisplayTitle(row),
    yearKm: inventoryYearKmLine(row),
    href: absoluteUrl(`/inventory/${row.id}`)
  };
}

function featuredToSuggested(u: FeaturedUnitJson): ChatSuggestedUnit | null {
  if (!isVehicleCategory(u.category)) return null;
  const row: InventoryPublicRow = {
    id: u.id,
    stock_number: u.stock_number,
    year: u.year,
    make: u.make,
    model: u.model,
    category: u.category,
    status: "Available",
    odometer_km: null,
    photo_paths: [],
    list_price_cad: null,
    created_at: "",
    updated_at: ""
  };
  return inventoryRowToChatSuggested(row);
}

/** Fetch public inventory rows by id (preserves caller id order). */
export async function fetchInventoryUnitsByIds(ids: string[]): Promise<ChatSuggestedUnit[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const { data, error } = await supabase.from("inventory_units_public").select("*").in("id", unique);
  if (error || !data) return [];

  const byId = new Map<string, ChatSuggestedUnit>();
  for (const raw of data) {
    const row = parseInventoryPublicRow(raw);
    if (!row) continue;
    byId.set(row.id, inventoryRowToChatSuggested(row));
  }

  return unique.map((id) => byId.get(id)).filter((u): u is ChatSuggestedUnit => u != null);
}

async function loadFeaturedFallback(): Promise<ChatSuggestedUnit[]> {
  try {
    const res = await fetch("/chat-featured-units.json", { cache: "no-store" });
    if (!res.ok) return [];
    const body = (await res.json()) as { units?: FeaturedUnitJson[] };
    const list = Array.isArray(body.units) ? body.units : [];
    return list.map(featuredToSuggested).filter((u): u is ChatSuggestedUnit => u != null);
  } catch {
    return [];
  }
}

/** Top available/pending units for chat (no filters when category omitted). */
export async function suggestInventoryForChat(params: ChatSuggestParams = {}): Promise<ChatSuggestedUnit[]> {
  const limit = params.limit ?? 3;
  const category = params.category ?? null;
  const q = (params.queryText ?? "").trim();
  const esc = q.replace(/%/g, "\\%").replace(/_/g, "\\_");

  let query = supabase
    .from("inventory_units_public")
    .select("*")
    .in("status", ["Available", "Pending"])
    .order("year", { ascending: false })
    .limit(limit * 4);

  if (category) {
    query = query.eq("category", category);
  }
  if (params.yearMin != null && Number.isFinite(params.yearMin)) {
    query = query.gte("year", params.yearMin);
  }
  if (params.yearMax != null && Number.isFinite(params.yearMax)) {
    query = query.lte("year", params.yearMax);
  }
  if (q.length >= 2) {
    query = query.or(`make.ilike.%${esc}%,model.ilike.%${esc}%`);
  }

  const { data, error } = await query;
  const fromDb: ChatSuggestedUnit[] = [];
  if (!error && data) {
    for (const raw of data) {
      const row = parseInventoryPublicRow(raw);
      if (!row) continue;
      fromDb.push(inventoryRowToChatSuggested(row));
      if (fromDb.length >= limit) break;
    }
  }

  if (fromDb.length >= limit) {
    return fromDb.slice(0, limit);
  }

  const featured = await loadFeaturedFallback();
  const seen = new Set(fromDb.map((u) => u.id));
  const merged = [...fromDb];
  for (const u of featured) {
    if (merged.length >= limit) break;
    if (category && u.category !== category) continue;
    if (seen.has(u.id)) continue;
    if (params.yearMin != null && u.year < params.yearMin) continue;
    if (params.yearMax != null && u.year > params.yearMax) continue;
    if (q.length >= 2) {
      const hay = `${u.make} ${u.model}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) continue;
    }
    seen.add(u.id);
    merged.push(u);
  }
  return merged.slice(0, limit);
}
