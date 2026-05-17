import {
  inventoryDisplayTitle,
  type InventoryPublicRow,
  type VehicleCategory
} from "../data/inventory";

/** Extra terms indexed per category so plain-language search finds the right units. */
const CATEGORY_SEARCH_TERMS: Record<VehicleCategory, string> = {
  Motorcycle:
    "motorcycle motorcycles bike bikes dirt dirtbike dirt bike sportbike sport bike cruiser street offroad off-road mx enduro",
  ATV: "atv atvs quad quads four wheeler 4x4 four-wheeler",
  Snowmobile: "snowmobile snowmobiles sled sleds snow machine",
  "Side by side": "side by side side-by-side sideside sxs utv utility ranger general",
  Watercraft:
    "watercraft marine jetski jet ski jet-ski jet skis seadoo sea-doo sea doo boat boats pwc waverunner wave runner yamaha waverunner",
  Trailer: "trailer trailers rv rvs camper campers hauler utility trailer enclosed"
};

/** Maps common search words to extra tokens checked against each unit's haystack. */
const SEARCH_TOKEN_ALIASES: Record<string, string[]> = {
  sled: ["snowmobile", "snow"],
  sleds: ["snowmobile"],
  snow: ["snowmobile"],
  jet: ["watercraft", "jetski"],
  jetski: ["watercraft", "jet", "ski"],
  jetskis: ["watercraft"],
  ski: ["watercraft", "jetski"],
  seadoo: ["watercraft", "sea", "doo"],
  "sea-doo": ["watercraft", "seadoo"],
  boat: ["watercraft", "marine"],
  boats: ["watercraft"],
  marine: ["watercraft"],
  pwc: ["watercraft"],
  dirt: ["motorcycle", "dirtbike"],
  bike: ["motorcycle"],
  bikes: ["motorcycle"],
  sportbike: ["motorcycle", "sport"],
  cruiser: ["motorcycle"],
  quad: ["atv"],
  quads: ["atv"],
  atv: ["atv"],
  atvs: ["atv"],
  sxs: ["side", "side by side"],
  utv: ["side", "side by side"],
  rv: ["trailer"],
  rvs: ["trailer"],
  camper: ["trailer"],
  motorcycle: ["motorcycle"],
  motorcycles: ["motorcycle"],
  snowmobile: ["snowmobile"],
  snowmobiles: ["snowmobile"],
  watercraft: ["watercraft"],
  trailer: ["trailer"],
  trailers: ["trailer"]
};

export function normalizeInventorySearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactAlphanumeric(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function tokenVariants(token: string): string[] {
  const variants = new Set<string>([token]);
  const aliases = SEARCH_TOKEN_ALIASES[token];
  if (aliases) {
    for (const alias of aliases) variants.add(alias);
  }
  if (token.includes("-")) {
    variants.add(token.replace(/-/g, ""));
    variants.add(token.replace(/-/g, " "));
  }
  return [...variants];
}

export function inventoryUnitSearchHaystack(row: InventoryPublicRow): string {
  const title = inventoryDisplayTitle(row);
  return normalizeInventorySearchText(
    [
      row.stock_number,
      String(row.year),
      row.make,
      row.model,
      title,
      row.category,
      row.status,
      CATEGORY_SEARCH_TERMS[row.category]
    ].join(" ")
  );
}

function haystackMatchesToken(haystack: string, compactHaystack: string, token: string): boolean {
  if (!token) return true;
  for (const variant of tokenVariants(token)) {
    if (haystack.includes(variant)) return true;
    const compactVariant = compactAlphanumeric(variant);
    if (compactVariant.length >= 2 && compactHaystack.includes(compactVariant)) return true;
  }
  return false;
}

export function inventoryRowMatchesSearch(row: InventoryPublicRow, rawQuery: string): boolean {
  const query = normalizeInventorySearchText(rawQuery);
  if (!query) return true;

  const haystack = inventoryUnitSearchHaystack(row);
  const compactHaystack = compactAlphanumeric(haystack);
  const compactQuery = compactAlphanumeric(query);

  if (haystack.includes(query)) return true;
  if (compactQuery.length >= 2 && compactHaystack.includes(compactQuery)) return true;

  const tokens = query.split(" ").filter(Boolean);
  if (tokens.length === 0) return true;

  return tokens.every((token) => haystackMatchesToken(haystack, compactHaystack, token));
}
