import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  INVENTORY_PHOTOS_BUCKET,
  INVENTORY_STATUS_VALUES,
  VEHICLE_CATEGORIES,
  inventoryDisplayTitle,
  inventoryStatusPillModifier,
  parseInventoryUnitRow,
  type InventoryStatus,
  type InventoryUnitRow,
  type VehicleCategory
} from "../data/inventory";
import { inventoryPhotoPublicUrl } from "../lib/inventoryPhotos";
import { supabase } from "../lib/supabase";

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

type FormFields = {
  stock_number: string;
  year: string;
  make: string;
  model: string;
  odometer_km: string;
  category: VehicleCategory;
  cost: string;
  status: InventoryStatus;
};

const emptyForm = (): FormFields => ({
  stock_number: "",
  year: new Date().getFullYear().toString(),
  make: "",
  model: "",
  odometer_km: "",
  category: "Motorcycle",
  cost: "0",
  status: "Available"
});

export function AdminInventoryPage() {
  const [units, setUnits] = useState<InventoryUnitRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [form, setForm] = useState<FormFields>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);

  const loadUnits = useCallback(async () => {
    setListLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.from("inventory_units").select("*").order("updated_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
      setUnits([]);
    } else {
      setUnits((data ?? []).map((r) => parseInventoryUnitRow(r)).filter((r): r is InventoryUnitRow => r != null));
    }
    setListLoading(false);
  }, []);

  useEffect(() => {
    void loadUnits();
  }, [loadUnits]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setPendingFiles(null);
    setFormError(null);
  };

  const startEdit = (row: InventoryUnitRow) => {
    setEditingId(row.id);
    setForm({
      stock_number: row.stock_number,
      year: String(row.year),
      make: row.make,
      model: row.model,
      odometer_km: row.odometer_km != null ? String(row.odometer_km) : "",
      category: row.category,
      cost: String(row.cost),
      status: row.status
    });
    setPendingFiles(null);
    setFormError(null);
  };

  const uploadNewPhotos = async (unitId: string, existing: string[], files: FileList): Promise<string[]> => {
    const added: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${unitId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
      const { error } = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false
      });
      if (error) throw new Error(error.message);
      added.push(path);
    }
    return [...existing, ...added];
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const year = Number.parseInt(form.year, 10);
    if (!Number.isFinite(year) || year < 1900 || year > 2100) {
      setFormError("Enter a valid year.");
      return;
    }
    const cost = Number.parseFloat(form.cost);
    if (!Number.isFinite(cost) || cost < 0) {
      setFormError("Enter a valid cost (0 or more).");
      return;
    }
    const odometer_km: number | null = (() => {
      if (form.odometer_km.trim() === "") return null;
      const k = Number.parseInt(form.odometer_km, 10);
      return Number.isFinite(k) && k >= 0 ? k : NaN;
    })();
    if (odometer_km !== null && Number.isNaN(odometer_km)) {
      setFormError("Enter a valid odometer (km) or leave blank.");
      return;
    }
    if (!form.stock_number.trim() || !form.make.trim() || !form.model.trim()) {
      setFormError("Stock number, make, and model are required.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        const existing = units.find((u) => u.id === editingId);
        let photo_paths = existing?.photo_paths ?? [];
        if (pendingFiles?.length) {
          photo_paths = await uploadNewPhotos(editingId, photo_paths, pendingFiles);
        }
        const { error } = await supabase
          .from("inventory_units")
          .update({
            stock_number: form.stock_number.trim(),
            year,
            make: form.make.trim(),
            model: form.model.trim(),
            odometer_km,
            category: form.category,
            cost,
            status: form.status,
            photo_paths
          })
          .eq("id", editingId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase
          .from("inventory_units")
          .insert({
            stock_number: form.stock_number.trim(),
            year,
            make: form.make.trim(),
            model: form.model.trim(),
            odometer_km,
            category: form.category,
            cost,
            status: form.status,
            photo_paths: []
          })
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        const row = parseInventoryUnitRow(data);
        if (!row) throw new Error("Invalid response from server.");
        if (pendingFiles?.length) {
          const photo_paths = await uploadNewPhotos(row.id, [], pendingFiles);
          const { error: upErr } = await supabase.from("inventory_units").update({ photo_paths }).eq("id", row.id);
          if (upErr) throw new Error(upErr.message);
        }
      }
      await loadUnits();
      resetForm();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed.");
    }
    setIsSaving(false);
  };

  const deleteUnit = async (row: InventoryUnitRow) => {
    if (!window.confirm(`Delete stock #${row.stock_number} (${inventoryDisplayTitle(row)})?`)) return;
    if (row.photo_paths.length) {
      await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).remove(row.photo_paths);
    }
    const { error } = await supabase.from("inventory_units").delete().eq("id", row.id);
    if (error) {
      window.alert(error.message);
      return;
    }
    if (editingId === row.id) resetForm();
    void loadUnits();
  };

  const removePhoto = async (row: InventoryUnitRow, path: string) => {
    await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).remove([path]);
    const next = row.photo_paths.filter((p) => p !== path);
    const { error } = await supabase.from("inventory_units").update({ photo_paths: next }).eq("id", row.id);
    if (error) {
      window.alert(error.message);
      return;
    }
    void loadUnits();
    if (editingId === row.id) {
      setForm((f) => ({ ...f }));
    }
  };

  return (
    <div className="admin-inventory">
      <header className="page-header">
        <h1 className="page-title">Admin inventory</h1>
        <p className="page-subtitle">
          Add or edit units. Cost is admin-only. Use <strong>Unlisted</strong> to hide a unit from the public inventory
          without deleting it; use <strong>Sold</strong> to show it on the site with a sold banner.
        </p>
      </header>

      <form className="admin-inventoryForm" onSubmit={(e) => void handleSubmit(e)}>
        <h2 className="admin-inventoryFormTitle">{editingId ? "Edit unit" : "Add unit"}</h2>
        <div className="admin-inventoryGrid">
          <div className="form-row">
            <label className="loginLabel" htmlFor="adm-stock">
              Stock #
            </label>
            <input
              id="adm-stock"
              className="loginInput"
              value={form.stock_number}
              onChange={(e) => setForm((f) => ({ ...f, stock_number: e.target.value }))}
              required
            />
          </div>
          <div className="form-row">
            <label className="loginLabel" htmlFor="adm-year">
              Year
            </label>
            <input
              id="adm-year"
              className="loginInput"
              type="number"
              value={form.year}
              onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
              required
            />
          </div>
          <div className="form-row">
            <label className="loginLabel" htmlFor="adm-make">
              Make
            </label>
            <input
              id="adm-make"
              className="loginInput"
              value={form.make}
              onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
              required
            />
          </div>
          <div className="form-row">
            <label className="loginLabel" htmlFor="adm-model">
              Model
            </label>
            <input
              id="adm-model"
              className="loginInput"
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              required
            />
          </div>
          <div className="form-row">
            <label className="loginLabel" htmlFor="adm-km">
              Odometer (km)
            </label>
            <input
              id="adm-km"
              className="loginInput"
              type="number"
              min={0}
              value={form.odometer_km}
              onChange={(e) => setForm((f) => ({ ...f, odometer_km: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div className="form-row">
            <label className="loginLabel" htmlFor="adm-cat">
              Category
            </label>
            <select
              id="adm-cat"
              className="select"
              style={{ width: "100%" }}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as VehicleCategory }))}
            >
              {VEHICLE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label className="loginLabel" htmlFor="adm-cost">
              Cost (CAD)
            </label>
            <input
              id="adm-cost"
              className="loginInput"
              type="number"
              min={0}
              step="0.01"
              value={form.cost}
              onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
              required
            />
          </div>
          <div className="form-row">
            <label className="loginLabel" htmlFor="adm-status">
              Status
            </label>
            <select
              id="adm-status"
              className="select"
              style={{ width: "100%" }}
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as InventoryStatus }))}
            >
              {INVENTORY_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {s === "Unlisted" ? "Unlisted (hidden on website)" : s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row">
          <label className="loginLabel" htmlFor="adm-files">
            Add photos
          </label>
          <input
            id="adm-files"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            key={editingId ?? "new"}
            onChange={(e) => setPendingFiles(e.target.files)}
          />
          <p className="admin-inventoryMuted" style={{ marginTop: "0.35rem" }}>
            After saving a new unit, photos upload automatically. Max 5 MB per file (see bucket settings in Supabase).
          </p>
        </div>
        {editingId ? (() => {
          const editRow = units.find((u) => u.id === editingId);
          if (!editRow) return null;
          return (
          <div className="form-row">
            <p className="loginLabel">Current photos</p>
            <div className="admin-inventoryPhotoRow">
              {editRow.photo_paths.map((p) => (
                <span key={p} className="admin-inventoryPhotoChip">
                  <img className="admin-inventoryThumb" src={inventoryPhotoPublicUrl(supabase, p)} alt="" />
                  <button type="button" className="btn btn-secondary" onClick={() => void removePhoto(editRow, p)}>
                    Remove
                  </button>
                </span>
              ))}
              {editRow.photo_paths.length === 0 ? <span className="admin-inventoryMuted">None yet</span> : null}
            </div>
          </div>
          );
        })() : null}
        {formError ? (
          <p className="loginError" role="alert">
            {formError}
          </p>
        ) : null}
        <div className="admin-inventoryActions">
          <button className="btn btn-primary" type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : editingId ? "Save changes" : "Create unit"}
          </button>
          {editingId ? (
            <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={isSaving}>
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      {loadError ? (
        <p className="loginError" role="alert">
          {loadError}
        </p>
      ) : listLoading ? (
        <p className="admin-inventoryMuted">Loading…</p>
      ) : (
        <div className="admin-inventoryTableWrap">
          <table className="admin-inventoryTable">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Stock</th>
                <th>Year</th>
                <th>Unit</th>
                <th>Km</th>
                <th>Cost</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {units.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.photo_paths[0] ? (
                      <img className="admin-inventoryThumb" src={inventoryPhotoPublicUrl(supabase, row.photo_paths[0]!)} alt="" />
                    ) : (
                      <span className="admin-inventoryMuted">—</span>
                    )}
                  </td>
                  <td>{row.stock_number}</td>
                  <td>{row.year}</td>
                  <td>
                    {inventoryDisplayTitle(row)}
                    <div className="admin-inventoryMuted">{row.category}</div>
                  </td>
                  <td>{row.odometer_km != null ? row.odometer_km.toLocaleString() : "—"}</td>
                  <td>{formatMoney(row.cost)}</td>
                  <td>
                    <span
                      className={`inventory-status inventory-status${inventoryStatusPillModifier(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="site-navLink" style={{ border: "none", background: "none", cursor: "pointer" }} onClick={() => startEdit(row)}>
                      Edit
                    </button>
                    {" · "}
                    <button type="button" className="site-navLink" style={{ border: "none", background: "none", cursor: "pointer" }} onClick={() => void deleteUnit(row)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
