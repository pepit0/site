/** Matches import-us-dealer-inventory IMPORT_WALL_MS (keep slightly under for UI). */
export const US_IMPORT_WALL_MS = 110_000;

export type UsImportSearchProgressTick = {
  completed: number;
  total: number;
  detailLine: string;
  title: string;
};

function importPhaseDetail(ratio: number): string {
  if (ratio < 0.2) return "Scanning dealer listings…";
  if (ratio < 0.5) return "Fetching vehicle details…";
  if (ratio < 0.8) return "Checking photos and fields…";
  return "Queueing matches…";
}

export function estimateUsImportSearchProgress(
  elapsedMs: number,
  requestedTotal: number
): UsImportSearchProgressTick {
  const estMs = Math.min(US_IMPORT_WALL_MS, 12_000 + requestedTotal * 7_000);
  const ratio = Math.min(1, elapsedMs / estMs);
  const eased = 1 - (1 - ratio) ** 1.8;
  const completed = ratio >= 0.995 ? 99 : Math.min(99, Math.floor(eased * 100));
  const unitLabel = requestedTotal === 1 ? "unit" : "units";

  return {
    completed,
    total: 100,
    detailLine: importPhaseDetail(ratio),
    title: `Searching for ${requestedTotal} ${unitLabel}…`
  };
}

export function usImportSearchCompleteProgress(
  requestedTotal: number,
  queued: number
): UsImportSearchProgressTick & { succeeded: number; failed: number } {
  const unitLabel = requestedTotal === 1 ? "unit" : "units";
  const notQueued = Math.max(0, requestedTotal - queued);

  return {
    completed: 100,
    total: 100,
    detailLine: "",
    title: queued === 0 ? "Search complete — no units queued" : `Queued ${queued} of ${requestedTotal} ${unitLabel}`,
    succeeded: queued,
    failed: notQueued
  };
}
