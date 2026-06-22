import type { InventoryPublicRow } from "../data/inventory";
import { inventoryPublicListPriceCad } from "./inventoryPublicPrice";

function normalizeMake(make: string): string {
  return make.trim().toLowerCase();
}

function priceDistance(a: InventoryPublicRow, b: InventoryPublicRow): number | null {
  const priceA = inventoryPublicListPriceCad(a);
  const priceB = inventoryPublicListPriceCad(b);
  if (priceA == null || priceB == null) return null;
  return Math.abs(priceA - priceB);
}

function scoreCandidate(current: InventoryPublicRow, candidate: InventoryPublicRow): number {
  let score = 0;
  if (candidate.category === current.category) score += 1000;
  if (normalizeMake(candidate.make) === normalizeMake(current.make)) score += 500;

  const distance = priceDistance(current, candidate);
  if (distance != null) {
    score += Math.max(0, 200 - Math.floor(distance / 500));
  }

  score += candidate.year;
  return score;
}

function sortCandidates(current: InventoryPublicRow, candidates: InventoryPublicRow[]): InventoryPublicRow[] {
  return [...candidates].sort((a, b) => {
    const scoreDiff = scoreCandidate(current, b) - scoreCandidate(current, a);
    if (scoreDiff !== 0) return scoreDiff;
    const updatedDiff = b.updated_at.localeCompare(a.updated_at);
    if (updatedDiff !== 0) return updatedDiff;
    return a.id.localeCompare(b.id);
  });
}

function eligibleCandidates(current: InventoryPublicRow, candidates: InventoryPublicRow[]): InventoryPublicRow[] {
  return candidates.filter((row) => row.id !== current.id && row.status !== "Sold");
}

function pickFromPool(
  current: InventoryPublicRow,
  pool: InventoryPublicRow[],
  limit: number,
  picked: InventoryPublicRow[]
): InventoryPublicRow[] {
  const seen = new Set(picked.map((row) => row.id));
  const next = sortCandidates(
    current,
    pool.filter((row) => !seen.has(row.id))
  );
  for (const row of next) {
    if (picked.length >= limit) break;
    picked.push(row);
    seen.add(row.id);
  }
  return picked;
}

/** Up to `limit` similar listings for internal linking (same category/make preferred). */
export function pickSimilarInventoryUnits(
  current: InventoryPublicRow,
  candidates: InventoryPublicRow[],
  limit = 4
): InventoryPublicRow[] {
  if (limit <= 0) return [];

  const eligible = eligibleCandidates(current, candidates);
  const picked: InventoryPublicRow[] = [];

  pickFromPool(
    current,
    eligible.filter((row) => row.category === current.category),
    limit,
    picked
  );

  if (picked.length < limit) {
    pickFromPool(
      current,
      eligible.filter((row) => normalizeMake(row.make) === normalizeMake(current.make)),
      limit,
      picked
    );
  }

  if (picked.length < limit) {
    pickFromPool(current, eligible, limit, picked);
  }

  return picked;
}
