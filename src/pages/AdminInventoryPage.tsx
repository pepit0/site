import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminImportQueuePanel } from "../components/AdminImportQueuePanel";
import { AdminSellQueuePanel } from "../components/AdminSellQueuePanel";
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

type AdminTab = "catalog" | "sell" | "import";

export function AdminInventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const adminTab: AdminTab =
    tabParam === "sell" ? "sell" : tabParam === "import" ? "import" : "catalog";

  const setAdminTab = (next: AdminTab) => {
    if (next === "sell") setSearchParams({ tab: "sell" }, { replace: true });
    else if (next === "import") setSearchParams({ tab: "import" }, { replace: true });
    else setSearchParams({}, { replace: true });
  };

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
    void Promise.resolve().then(() => loadUnits());
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
    <div className="admin-inv">
      <header className="admin-invHeader page-header">
        <h1 className="page-title">Admin inventory</h1>
        <p className="page-subtitle admin-invHeaderSubtitle">
          Manage the public catalog, sell-your-ride submissions, and staged MSF imports in one place. Cost stays admin-only. Use{" "}
          <strong>Unlisted</strong> to hide a unit without deleting it; use <strong>Sold</strong> for the sold banner
          on the site.
        </p>
      </header>

      <nav className="admin-invTabs" aria-label="Admin inventory sections">
        <button
          type="button"
          className={adminTab === "catalog" ? "admin-invTab admin-invTabActive" : "admin-invTab"}
          aria-current={adminTab === "catalog" ? "page" : undefined}
          onClick={() => setAdminTab("catalog")}
        >
          Catalog
        </button>
        <span className="admin-invTabDivider" aria-hidden />
        <button
          type="button"
          className={adminTab === "sell" ? "admin-invTab admin-invTabActive" : "admin-invTab"}
          aria-current={adminTab === "sell" ? "page" : undefined}
          onClick={() => setAdminTab("sell")}
        >
          Sell submissions
        </button>
        <span className="admin-invTabDivider" aria-hidden />
        <button
          type="button"
          className={adminTab === "import" ? "admin-invTab admin-invTabActive" : "admin-invTab"}
          aria-current={adminTab === "import" ? "page" : undefined}
          onClick={() => setAdminTab("import")}
        >
          MSF import
        </button>
      </nav>

      {adminTab === "sell" ? (
        <AdminSellQueuePanel onInventoryChanged={() => void loadUnits()} />
      ) : adminTab === "import" ? (
        <AdminImportQueuePanel onInventoryChanged={() => void loadUnits()} />
      ) : (
        <>
          <section className="sell-ride-applyForm admin-invFormPanel" aria-labelledby="admin-inv-form-heading">
            <h2 id="admin-inv-form-heading" className="sell-ride-applySectionTitle">
              {editingId ? "Edit unit" : "Add unit"}
            </h2>
            <form className="admin-invFormInner" onSubmit={(e) => void handleSubmit(e)}>
              <div className="sell-ride-applyGrid">
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
                    className="select sell-ride-applySelect"
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
                    className="select sell-ride-applySelect"
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
                <div className="form-row sell-ride-applyFullWidth">
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
                  <p className="sell-ride-applyHint">
                    After saving a new unit, photos upload automatically. Max 5 MB per file (see bucket settings in
                    Supabase).
                  </p>
                </div>
                {editingId ? (() => {
                  const editRow = units.find((u) => u.id === editingId);
                  if (!editRow) return null;
                  return (
                    <div className="form-row sell-ride-applyFullWidth">
                      <p className="loginLabel">Current photos</p>
                      <div className="admin-invPhotoRow">
                        {editRow.photo_paths.map((p) => (
                          <span key={p} className="admin-invPhotoChip">
                            <img className="admin-invThumb" src={inventoryPhotoPublicUrl(supabase, p)} alt="" />
                            <button type="button" className="btn btn-secondary admin-invMiniBtn" onClick={() => void removePhoto(editRow, p)}>
                              Remove
                            </button>
                          </span>
                        ))}
                        {editRow.photo_paths.length === 0 ? <span className="sell-ride-applyMuted">None yet</span> : null}
                      </div>
                    </div>
                  );
                })() : null}
              </div>
              {formError ? (
                <div className="sell-ride-applyErrorBanner" role="alert">
                  <p className="sell-ride-applyError">{formError}</p>
                </div>
              ) : null}
              <div className="sell-ride-applyActions sell-ride-applyActionsEnd">
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
          </section>

          <section className="sell-ride-applyForm admin-invTablePanel" aria-labelledby="admin-inv-table-heading">
            <h2 id="admin-inv-table-heading" className="sell-ride-applySectionTitle">
              Units
            </h2>
            {loadError ? (
              <div className="sell-ride-applyErrorBanner" role="alert">
                <p className="sell-ride-applyError">{loadError}</p>
              </div>
            ) : listLoading ? (
              <p className="sell-ride-applyMuted">Loading…</p>
            ) : (
              <div className="admin-invTableScroll">
                <table className="admin-invTable">
                  <thead>
                    <tr>
                      <th>Photo</th>
                      <th>Stock</th>
                      <th>Year</th>
                      <th>Unit</th>
                      <th>Km</th>
                      <th>Cost</th>
                      <th>Status</th>
                      <th className="admin-invTableActionsCol">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {row.photo_paths[0] ? (
                            <img className="admin-invThumb" src={inventoryPhotoPublicUrl(supabase, row.photo_paths[0]!)} alt="" />
                          ) : (
                            <span className="sell-ride-applyMuted">—</span>
                          )}
                        </td>
                        <td>{row.stock_number}</td>
                        <td>{row.year}</td>
                        <td>
                          {inventoryDisplayTitle(row)}
                          <div className="admin-invTableCategory">{row.category}</div>
                        </td>
                        <td>{row.odometer_km != null ? row.odometer_km.toLocaleString() : "—"}</td>
                        <td>{formatMoney(row.cost)}</td>
                        <td>
                          <span className={`inventory-status inventory-status${inventoryStatusPillModifier(row.status)}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="admin-invTableActionsCol">
                          <div className="admin-invRowActions">
                            <button type="button" className="btn btn-secondary admin-invMiniBtn" onClick={() => startEdit(row)}>
                              Edit
                            </button>
                            <button type="button" className="btn btn-secondary admin-invMiniBtn" onClick={() => void deleteUnit(row)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
