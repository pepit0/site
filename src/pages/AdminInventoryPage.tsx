import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminCustomerUnitsPanel } from "../components/AdminCustomerUnitsPanel";
import { AdminImportQueuePanel } from "../components/AdminImportQueuePanel";
import { AdminSellQueuePanel } from "../components/AdminSellQueuePanel";
import { AdminStockDuplicateError } from "../components/AdminStockDuplicateError";
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
import {
  findInventoryUnitByStock,
  isStockNumberUniqueViolation,
  normalizeStockNumber,
  type StockDuplicateMatch
} from "../lib/inventoryStockDuplicate";
import { supabase } from "../lib/supabase";
import { Seo } from "../seo/Seo";

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
  is_customer_unit: boolean;
  vin: string;
  admin_notes: string;
};

const emptyForm = (): FormFields => ({
  stock_number: "",
  year: new Date().getFullYear().toString(),
  make: "",
  model: "",
  odometer_km: "",
  category: "Motorcycle",
  cost: "0",
  status: "Available",
  is_customer_unit: false,
  vin: "",
  admin_notes: ""
});

type AdminTab = "catalog" | "sell" | "import" | "customer";

export function AdminInventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const editParam = searchParams.get("edit");
  const adminTab: AdminTab =
    tabParam === "sell"
      ? "sell"
      : tabParam === "import"
        ? "import"
        : tabParam === "customer"
          ? "customer"
          : "catalog";

  const setAdminTab = (next: AdminTab) => {
    if (next === "sell") setSearchParams({ tab: "sell" }, { replace: true });
    else if (next === "import") setSearchParams({ tab: "import" }, { replace: true });
    else if (next === "customer") setSearchParams({ tab: "customer" }, { replace: true });
    else if (editParam) setSearchParams({ edit: editParam }, { replace: true });
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
  const [stockDuplicate, setStockDuplicate] = useState<StockDuplicateMatch | null>(null);

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

  const startEdit = useCallback((row: InventoryUnitRow) => {
    setEditingId(row.id);
    setForm({
      stock_number: row.stock_number,
      year: String(row.year),
      make: row.make,
      model: row.model,
      odometer_km: row.odometer_km != null ? String(row.odometer_km) : "",
      category: row.category,
      cost: String(row.cost),
      status: row.status,
      is_customer_unit: row.is_customer_unit,
      vin: row.vin ?? "",
      admin_notes: row.admin_notes ?? ""
    });
    setPendingFiles(null);
    setFormError(null);
    setStockDuplicate(null);
  }, []);

  useEffect(() => {
    if (!editParam || listLoading || adminTab !== "catalog") return;
    const row = units.find((u) => u.id === editParam);
    if (row && editingId !== editParam) {
      startEdit(row);
    }
  }, [editParam, listLoading, units, adminTab, editingId, startEdit]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setPendingFiles(null);
    setFormError(null);
    setStockDuplicate(null);
    if (editParam) setSearchParams({}, { replace: true });
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
    setStockDuplicate(null);
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
    const stock = normalizeStockNumber(form.stock_number);
    if (!stock || !form.make.trim() || !form.model.trim()) {
      setFormError("Stock number, make, and model are required.");
      return;
    }

    const vinPayload = form.is_customer_unit ? form.vin.trim() || null : null;
    const adminNotesPayload = form.admin_notes.trim() || null;

    try {
      const dup = await findInventoryUnitByStock(supabase, stock, editingId);
      if (dup) {
        setStockDuplicate(dup);
        return;
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not verify stock number.");
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
            stock_number: stock,
            year,
            make: form.make.trim(),
            model: form.model.trim(),
            odometer_km,
            category: form.category,
            cost,
            status: form.status,
            photo_paths,
            is_customer_unit: form.is_customer_unit,
            vin: vinPayload,
            admin_notes: adminNotesPayload
          })
          .eq("id", editingId);
        if (error) {
          if (isStockNumberUniqueViolation(error.message)) {
            const dup = await findInventoryUnitByStock(supabase, stock, editingId);
            if (dup) {
              setStockDuplicate(dup);
              return;
            }
          }
          throw new Error(error.message);
        }
      } else {
        const { data, error } = await supabase
          .from("inventory_units")
          .insert({
            stock_number: stock,
            year,
            make: form.make.trim(),
            model: form.model.trim(),
            odometer_km,
            category: form.category,
            cost,
            status: form.status,
            photo_paths: [],
            is_customer_unit: form.is_customer_unit,
            vin: vinPayload,
            admin_notes: adminNotesPayload
          })
          .select("*")
          .single();
        if (error) {
          if (isStockNumberUniqueViolation(error.message)) {
            const dup = await findInventoryUnitByStock(supabase, stock);
            if (dup) {
              setStockDuplicate(dup);
              return;
            }
          }
          throw new Error(error.message);
        }
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
    if (!window.confirm("Remove this photo from the unit? It will be deleted from storage.")) return;
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

  const wideAdminLayout = adminTab === "sell" || adminTab === "import" || adminTab === "customer";
  const rootClass = wideAdminLayout ? "admin-inv admin-inv--queues" : "admin-inv admin-inv--catalog";

  return (
    <div className={rootClass}>
      <Seo title="Admin inventory" description="Internal inventory management for Temptation Motorsports." path="/admin/inventory" noindex />
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
        <span className="admin-invTabDivider" aria-hidden />
        <button
          type="button"
          className={adminTab === "customer" ? "admin-invTab admin-invTabActive" : "admin-invTab"}
          aria-current={adminTab === "customer" ? "page" : undefined}
          onClick={() => setAdminTab("customer")}
        >
          Customer units
        </button>
      </nav>

      {adminTab === "sell" ? (
        <AdminSellQueuePanel onInventoryChanged={() => void loadUnits()} />
      ) : adminTab === "import" ? (
        <AdminImportQueuePanel onInventoryChanged={() => void loadUnits()} />
      ) : adminTab === "customer" ? (
        <AdminCustomerUnitsPanel />
      ) : (
        <div className="admin-invCatalogLayout">
          <section
            className="sell-ride-applyForm admin-invListPanel"
            aria-labelledby="admin-inv-list-heading"
          >
            <div className="admin-invListPanelHead">
              <h2 id="admin-inv-list-heading" className="sell-ride-applyPhotosTitle">
                Units
              </h2>
              <button
                type="button"
                className={`btn btn-secondary admin-invMiniBtn admin-invAddUnitBtn${!editingId ? " admin-invAddUnitBtnActive" : ""}`}
                onClick={resetForm}
              >
                Add new
              </button>
            </div>
            {loadError ? (
              <div className="sell-ride-applyErrorBanner" role="alert">
                <p className="sell-ride-applyError">{loadError}</p>
              </div>
            ) : listLoading ? (
              <p className="sell-ride-applyMuted">Loading…</p>
            ) : units.length === 0 ? (
              <p className="sell-ride-applyMuted">No units yet.</p>
            ) : (
              <div className="admin-invUnitListScroll">
                <ul className="admin-invUnitItems">
                  {units.map((row) => {
                    const active = row.id === editingId;
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          className={`admin-invUnitItem${active ? " admin-invUnitItemActive" : ""}`}
                          onClick={() => startEdit(row)}
                        >
                          {row.photo_paths[0] ? (
                            <img
                              className="admin-invUnitItemThumb"
                              src={inventoryPhotoPublicUrl(supabase, row.photo_paths[0]!)}
                              alt=""
                            />
                          ) : (
                            <span className="admin-invUnitItemThumbPlaceholder" aria-hidden>
                              —
                            </span>
                          )}
                          <span className="admin-invUnitItemText">
                            <span className="admin-invUnitItemTitle">
                              #{row.stock_number} · {inventoryDisplayTitle(row)}
                            </span>
                            <span className="admin-invUnitItemMeta">
                              {row.year}
                              {row.odometer_km != null ? ` · ${row.odometer_km.toLocaleString()} km` : ""}
                              {` · ${formatMoney(row.cost)}`}
                            </span>
                            <span
                              className={`inventory-status inventory-status${inventoryStatusPillModifier(row.status)} admin-invUnitItemStatus`}
                            >
                              {row.status}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          <section className="sell-ride-applyForm admin-invFormPanel admin-invDetailPanel" aria-labelledby="admin-inv-form-heading">
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
                  <label className="admin-checkRow">
                    <input
                      type="checkbox"
                      checked={form.is_customer_unit}
                      onChange={(e) => setForm((f) => ({ ...f, is_customer_unit: e.target.checked }))}
                    />
                    Customer unit
                  </label>
                  <p className="sell-ride-applyHint">Consignment or customer-owned unit you list for them. Tracked under Customer units.</p>
                </div>
                {form.is_customer_unit ? (
                  <div className="form-row sell-ride-applyFullWidth">
                    <label className="loginLabel" htmlFor="adm-vin">
                      VIN
                    </label>
                    <input
                      id="adm-vin"
                      className="loginInput"
                      value={form.vin}
                      onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value }))}
                      placeholder="Optional — type none if not available"
                    />
                  </div>
                ) : null}
                <div className="form-row sell-ride-applyFullWidth">
                  <label className="loginLabel" htmlFor="adm-admin-notes">
                    Internal notes
                  </label>
                  <textarea
                    id="adm-admin-notes"
                    className="loginInput textarea"
                    rows={3}
                    value={form.admin_notes}
                    onChange={(e) => setForm((f) => ({ ...f, admin_notes: e.target.value }))}
                    placeholder="Admin-only — not shown on the public listing"
                  />
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
              {stockDuplicate ? (
                <AdminStockDuplicateError stock={normalizeStockNumber(form.stock_number)} match={stockDuplicate} />
              ) : null}
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
                  <>
                    <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={isSaving}>
                      Cancel edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={isSaving}
                      onClick={() => {
                        const row = units.find((u) => u.id === editingId);
                        if (row) void deleteUnit(row);
                      }}
                    >
                      Delete unit
                    </button>
                  </>
                ) : null}
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
