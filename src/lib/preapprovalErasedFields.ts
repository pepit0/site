/** Track last non-empty value before a field is cleared (one value per field). */

export type PreapprovalErasedFields = Record<string, string>;

const TRACKED_FIELDS = ["phone", "sin"] as const;

export type TrackedErasedField = (typeof TRACKED_FIELDS)[number];

export function isTrackedErasedField(key: string): key is TrackedErasedField {
  return (TRACKED_FIELDS as readonly string[]).includes(key);
}

export function normalizeErasedFieldValue(field: TrackedErasedField, raw: string): string {
  const t = raw.trim();
  if (field === "phone") {
    return t.replace(/\D/g, "");
  }
  if (field === "sin") {
    return t.replace(/\D/g, "");
  }
  return t;
}

/**
 * Call when a tracked field changes. Returns updated erased map (immutable).
 */
export function applyErasedFieldChange(
  field: TrackedErasedField,
  previousValue: string,
  nextValue: string,
  erased: PreapprovalErasedFields
): PreapprovalErasedFields {
  const prevNorm = normalizeErasedFieldValue(field, previousValue);
  const nextNorm = normalizeErasedFieldValue(field, nextValue);

  if (nextNorm.length > 0) {
    if (!(field in erased)) return erased;
    const { [field]: _removed, ...rest } = erased;
    return rest;
  }

  if (prevNorm.length === 0) return erased;

  return { ...erased, [field]: prevNorm };
}

export function createEmptyErasedFields(): PreapprovalErasedFields {
  return {};
}
