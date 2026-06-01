import { useMemo, useState } from "react";
import { VEHICLE_CATEGORIES, type VehicleCategory } from "../data/inventory";
import {
  createEmptyUsCategoryCounts,
  sumCategoryCounts,
  type UsImportCategoryCounts
} from "../lib/importUsDealerInventory";

export type AdminUsImportModalProps = {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: { total: number; categoryCounts: UsImportCategoryCounts; usedOnly: boolean }) => void;
};

export function AdminUsImportModal({ open, busy, onClose, onSubmit }: AdminUsImportModalProps) {
  const [total, setTotal] = useState(10);
  const [usedOnly, setUsedOnly] = useState(true);
  const [categoryCounts, setCategoryCounts] = useState<UsImportCategoryCounts>(() => createEmptyUsCategoryCounts());

  const assigned = useMemo(() => sumCategoryCounts(categoryCounts), [categoryCounts]);
  const remaining = total - assigned;
  const valid = assigned === total && total >= 1 && total <= 30;

  if (!open) return null;

  const setCategory = (cat: VehicleCategory, value: number) => {
    const n = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
    setCategoryCounts((prev) => ({ ...prev, [cat]: n }));
  };

  const distributeEvenly = () => {
    const base = Math.floor(total / VEHICLE_CATEGORIES.length);
    let leftover = total - base * VEHICLE_CATEGORIES.length;
    const next = createEmptyUsCategoryCounts();
    for (const cat of VEHICLE_CATEGORIES) {
      next[cat] = base + (leftover > 0 ? 1 : 0);
      if (leftover > 0) leftover -= 1;
    }
    setCategoryCounts(next);
  };

  return (
    <div className="admin-usImportOverlay" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="admin-usImportModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-us-import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="admin-us-import-title" className="admin-usImportTitle">
          Import US dealer units
        </h3>
        <p className="sell-ride-applyHint admin-usImportIntro">
          Pull selective listings from configured US dealer sources (RideNow and others). Each unit needs at least 5
          photos plus make, model, and year. Price is saved in source notes when available.
        </p>

        <div className="admin-usImportTotalRow">
          <label className="loginLabel" htmlFor="admin-us-import-total">
            Total units (1–30)
          </label>
          <input
            id="admin-us-import-total"
            className="loginInput admin-usImportTotalInput"
            type="number"
            min={1}
            max={30}
            value={total}
            disabled={busy}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              setTotal(Number.isFinite(n) ? Math.min(30, Math.max(1, n)) : 1);
            }}
          />
          <button type="button" className="btn btn-secondary admin-invMiniBtn" disabled={busy} onClick={distributeEvenly}>
            Split evenly
          </button>
        </div>

        <p className={`admin-usImportAssignHint${valid ? "" : " admin-usImportAssignHintWarn"}`} role="status">
          {assigned} of {total} assigned{remaining !== 0 ? ` (${remaining > 0 ? `${remaining} remaining` : `${-remaining} over`})` : ""}
        </p>

        <div className="admin-usImportCategoryGrid">
          {VEHICLE_CATEGORIES.map((cat) => (
            <div key={cat} className="form-row">
              <label className="loginLabel" htmlFor={`admin-us-cat-${cat}`}>
                {cat}
              </label>
              <input
                id={`admin-us-cat-${cat}`}
                className="loginInput"
                type="number"
                min={0}
                max={30}
                value={categoryCounts[cat]}
                disabled={busy}
                onChange={(e) => setCategory(cat, Number.parseInt(e.target.value, 10))}
              />
            </div>
          ))}
        </div>

        <label className="admin-usImportUsedOnly">
          <input type="checkbox" checked={usedOnly} disabled={busy} onChange={(e) => setUsedOnly(e.target.checked)} />
          Used inventory only
        </label>

        <div className="admin-usImportActions">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !valid}
            onClick={() => onSubmit({ total, categoryCounts, usedOnly })}
          >
            {busy ? "Importing…" : `Import ${total} unit${total === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
