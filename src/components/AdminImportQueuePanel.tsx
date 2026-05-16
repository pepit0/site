import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  INVENTORY_PHOTOS_BUCKET,
  INVENTORY_STATUS_VALUES,
  VEHICLE_CATEGORIES,
  parseInventoryUnitRow,
  type InventoryStatus,
  type VehicleCategory
} from "../data/inventory";
import { parseInventoryImportQueueRow, type InventoryImportQueueRow, type InventoryImportQueueStatus } from "../data/inventoryImportQueue";
import { supabase } from "../lib/supabase";
import { AdminQueuePhotoTile } from "./AdminQueuePhotoTile";

function guessImageExt(url: string, contentType: string | null): string {
  const path = (url.split("?")[0] ?? "").toLowerCase();
  if (path.endsWith(".png")) return "png";
  if (path.endsWith(".webp")) return "webp";
  if (path.endsWith(".gif")) return "gif";
  if (path.endsWith(".jpeg") || path.endsWith(".jpg")) return "jpg";
  const ct = contentType?.toLowerCase() ?? "";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

async function downloadUrlAsBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "no-store" });
  if (!res.ok) throw new Error(`Image download failed (${res.status}) for ${url.slice(0, 80)}…`);
  return res.blob();
}

type QueueTab = "pending" | "posted" | "skipped";

export type AdminImportQueuePanelProps = {
  onInventoryChanged?: () => void;
};

function rowTitle(r: InventoryImportQueueRow): string {
  const y = r.year != null ? String(r.year) : "?";
  const mk = r.make?.trim() || "";
  const md = r.model?.trim() || "";
  const core = `${mk} ${md}`.trim();
  if (core) return `${y} ${core}`;
  return r.source_product_name?.trim() || `Woo #${r.source_product_id}`;
}

export function AdminImportQueuePanel({ onInventoryChanged }: AdminImportQueuePanelProps) {
  const [queueTab, setQueueTab] = useState<QueueTab>("pending");
  const [rows, setRows] = useState<InventoryImportQueueRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [removingPhotoUrl, setRemovingPhotoUrl] = useState<string | null>(null);
  const [photoRemoveError, setPhotoRemoveError] = useState<string | null>(null);

  const [editStock, setEditStock] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editMake, setEditMake] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editKm, setEditKm] = useState("");
  const [editCategory, setEditCategory] = useState<VehicleCategory>("Motorcycle");

  const [pubCost, setPubCost] = useState("0");
  const [pubStatus, setPubStatus] = useState<InventoryStatus>("Available");

  const applyRowToForm = (row: InventoryImportQueueRow | null) => {
    setSaveError(null);
    setPublishError(null);
    setActionError(null);
    if (!row) {
      setEditStock("");
      setEditYear("");
      setEditMake("");
      setEditModel("");
      setEditKm("");
      setEditCategory("Motorcycle");
      setPubCost("0");
      setPubStatus("Available");
      return;
    }
    setEditStock(row.stock_number);
    setEditYear(row.year != null ? String(row.year) : "");
    setEditMake(row.make ?? "");
    setEditModel(row.model ?? "");
    setEditKm(row.odometer_km != null ? String(row.odometer_km) : "");
    setEditCategory(row.category);
    setPubCost("0");
    setPubStatus("Available");
  };

  const fetchRows = useCallback(async (tab: QueueTab): Promise<InventoryImportQueueRow[]> => {
    setLoading(true);
    setLoadError(null);
    const statusFilter: InventoryImportQueueStatus = tab;
    const { data, error } = await supabase
      .from("inventory_import_queue")
      .select("*")
      .eq("status", statusFilter)
      .order("updated_at", { ascending: false });
    let parsed: InventoryImportQueueRow[] = [];
    if (error) {
      setLoadError(error.message);
      setRows([]);
    } else {
      parsed = (data ?? [])
        .map((r) => parseInventoryImportQueueRow(r))
        .filter((r): r is InventoryImportQueueRow => r != null && r.status === statusFilter);
      setRows(parsed);
    }
    setLoading(false);
    return parsed;
  }, []);

  const reloadCurrentTab = useCallback(async () => fetchRows(queueTab), [queueTab, fetchRows]);

  useEffect(() => {
    void Promise.resolve().then(() => reloadCurrentTab());
  }, [reloadCurrentTab]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const setQueueTabAndReset = (tab: QueueTab) => {
    setQueueTab(tab);
    setSelectedId(null);
    setActionError(null);
    setSaveError(null);
    setPublishError(null);
    applyRowToForm(null);
  };

  const selectRow = (id: string | null) => {
    setSelectedId(id);
    const row = id ? rows.find((r) => r.id === id) ?? null : null;
    applyRowToForm(row);
  };

  const saveEdits = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || selected.status !== "pending") return;
    setSaveError(null);
    const year = Number.parseInt(editYear, 10);
    if (!Number.isFinite(year) || year < 1900 || year > 2100) {
      setSaveError("Enter a valid year.");
      return;
    }
    const kmRaw = editKm.trim();
    const odometer_km: number | null =
      kmRaw === "" ? null : (() => {
        const k = Number.parseInt(kmRaw, 10);
        return Number.isFinite(k) && k >= 0 ? k : NaN;
      })();
    if (odometer_km !== null && Number.isNaN(odometer_km)) {
      setSaveError("Enter a valid odometer (km) or leave blank.");
      return;
    }
    if (!editStock.trim() || !editMake.trim() || !editModel.trim()) {
      setSaveError("Stock number, make, and model are required.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("inventory_import_queue")
      .update({
        stock_number: editStock.trim(),
        year,
        make: editMake.trim(),
        model: editModel.trim(),
        odometer_km,
        category: editCategory
      })
      .eq("id", selected.id)
      .eq("status", "pending");
    if (error) {
      setSaveError(error.message);
    } else {
      const next = await reloadCurrentTab();
      const sid = selected.id;
      applyRowToForm(next.find((x) => x.id === sid) ?? null);
    }
    setSaving(false);
  };

  const removeSourcePhoto = async (url: string) => {
    if (!selected || selected.status !== "pending") return;
    if (!window.confirm("Remove this image from the import row? It will not be downloaded when you post to catalog.")) return;

    setRemovingPhotoUrl(url);
    setPhotoRemoveError(null);
    const nextUrls = selected.source_photo_urls.filter((u) => u !== url);
    const { error } = await supabase
      .from("inventory_import_queue")
      .update({ source_photo_urls: nextUrls })
      .eq("id", selected.id)
      .eq("status", "pending");
    if (error) {
      setPhotoRemoveError(error.message);
      setRemovingPhotoUrl(null);
      return;
    }
    const next = await reloadCurrentTab();
    const sid = selected.id;
    applyRowToForm(next.find((x) => x.id === sid) ?? null);
    setRemovingPhotoUrl(null);
  };

  const skipSelected = async () => {
    if (!selected || selected.status !== "pending") return;
    if (!window.confirm("Skip this import row? You can restore it from the Skipped tab later.")) return;
    setActionBusy(true);
    setActionError(null);
    const { error } = await supabase.from("inventory_import_queue").update({ status: "skipped" }).eq("id", selected.id).eq("status", "pending");
    if (error) {
      setActionError(error.message);
    } else {
      setSelectedId(null);
      applyRowToForm(null);
      await reloadCurrentTab();
    }
    setActionBusy(false);
  };

  const restoreSkipped = async () => {
    if (!selected || selected.status !== "skipped") return;
    setActionBusy(true);
    setActionError(null);
    const { error } = await supabase.from("inventory_import_queue").update({ status: "pending" }).eq("id", selected.id).eq("status", "skipped");
    if (error) {
      setActionError(error.message);
    } else {
      setQueueTab("pending");
      const next = await fetchRows("pending");
      setSelectedId(selected.id);
      applyRowToForm(next.find((x) => x.id === selected.id) ?? null);
    }
    setActionBusy(false);
  };

  const publishSelected = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || selected.status !== "pending") return;
    setPublishError(null);
    const cost = Number.parseFloat(pubCost);
    if (!Number.isFinite(cost) || cost < 0) {
      setPublishError("Enter a valid cost.");
      return;
    }
    const year = Number.parseInt(editYear, 10);
    if (!Number.isFinite(year) || year < 1900 || year > 2100) {
      setPublishError("Enter a valid year before posting.");
      return;
    }
    const kmRaw = editKm.trim();
    const odometer_km: number | null =
      kmRaw === "" ? null : (() => {
        const k = Number.parseInt(kmRaw, 10);
        return Number.isFinite(k) && k >= 0 ? k : NaN;
      })();
    if (odometer_km !== null && Number.isNaN(odometer_km)) {
      setPublishError("Fix odometer (km) or leave blank.");
      return;
    }
    const stock = editStock.trim();
    if (!stock) {
      setPublishError("Stock number is required.");
      return;
    }
    if (!editMake.trim() || !editModel.trim()) {
      setPublishError("Make and model are required.");
      return;
    }
    if (selected.source_photo_urls.length < 1) {
      setPublishError("This row has no source image URLs. Re-run the import script or fix the listing on the source site.");
      return;
    }

    setPublishing(true);
    let unitId: string | null = null;
    const newPaths: string[] = [];
    try {
      const { data: inserted, error: insErr } = await supabase
        .from("inventory_units")
        .insert({
          stock_number: stock,
          year,
          make: editMake.trim(),
          model: editModel.trim(),
          odometer_km,
          category: editCategory,
          cost,
          status: pubStatus,
          photo_paths: []
        })
        .select("*")
        .single();
      if (insErr) throw new Error(insErr.message);
      const row = parseInventoryUnitRow(inserted);
      if (!row) throw new Error("Invalid inventory response.");
      unitId = row.id;

      let i = 0;
      for (const imageUrl of selected.source_photo_urls) {
        const blob = await downloadUrlAsBlob(imageUrl);
        const ext = guessImageExt(imageUrl, blob.type || null);
        const nextPath = `${unitId}/import-${String(i).padStart(2, "0")}.${ext}`;
        const { error: upErr } = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).upload(nextPath, blob, {
          cacheControl: "3600",
          upsert: false
        });
        if (upErr) throw new Error(upErr.message);
        newPaths.push(nextPath);
        i += 1;
      }

      const { error: upRowErr } = await supabase.from("inventory_units").update({ photo_paths: newPaths }).eq("id", unitId);
      if (upRowErr) throw new Error(upRowErr.message);

      const { error: qErr } = await supabase
        .from("inventory_import_queue")
        .update({ status: "posted", imported_inventory_id: unitId })
        .eq("id", selected.id)
        .eq("status", "pending");
      if (qErr) throw new Error(qErr.message);

      setSelectedId(null);
      applyRowToForm(null);
      await reloadCurrentTab();
      onInventoryChanged?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Publish failed.";
      setPublishError(msg);
      if (unitId) {
        if (newPaths.length) {
          await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).remove(newPaths);
        }
        await supabase.from("inventory_units").delete().eq("id", unitId);
      }
    }
    setPublishing(false);
  };

  return (
    <section className="admin-sell-queueIntegrated" aria-labelledby="admin-import-heading">
      <h2 id="admin-import-heading" className="sell-ride-applySectionTitle admin-sell-queueIntegratedTitle">
        MSF import queue
      </h2>
      <p className="admin-invPanelIntro">
        Rows are filled by <code className="staff-code">npm run msf:queue</code> (service role in <code className="staff-code">.env.local</code>
        ). Review each unit, adjust fields if needed, then post to the catalog. Images are downloaded from the source URLs into the inventory
        bucket when you post.
      </p>

      <div className="admin-sell-queueQueueTabs" role="tablist" aria-label="Import queue status">
        <button
          type="button"
          role="tab"
          aria-selected={queueTab === "pending"}
          className={`admin-sell-queueQueueTab${queueTab === "pending" ? " admin-sell-queueQueueTabActive" : ""}`}
          onClick={() => setQueueTabAndReset("pending")}
        >
          Pending
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={queueTab === "posted"}
          className={`admin-sell-queueQueueTab${queueTab === "posted" ? " admin-sell-queueQueueTabActive" : ""}`}
          onClick={() => setQueueTabAndReset("posted")}
        >
          Posted
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={queueTab === "skipped"}
          className={`admin-sell-queueQueueTab${queueTab === "skipped" ? " admin-sell-queueQueueTabActive" : ""}`}
          onClick={() => setQueueTabAndReset("skipped")}
        >
          Skipped
        </button>
      </div>

      {loadError ? (
        <div className="sell-ride-applyErrorBanner" role="alert">
          <p className="sell-ride-applyError">{loadError}</p>
        </div>
      ) : null}

      <div className="admin-sell-queueLayout">
        <div className="sell-ride-applyForm admin-sell-queueCard" aria-label="Import queue list">
          <h3 className="sell-ride-applyPhotosTitle">
            {queueTab === "pending" ? "Pending" : queueTab === "posted" ? "Posted" : "Skipped"}
          </h3>
          {loading ? (
            <p className="sell-ride-applyMuted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="sell-ride-applyMuted">No rows in this queue.</p>
          ) : (
            <ul className="admin-sell-queueItems">
              {rows.map((r) => {
                const title = rowTitle(r);
                const active = r.id === selectedId;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={`admin-sell-queueItem${active ? " admin-sell-queueItemActive" : ""}`}
                      onClick={() => selectRow(r.id)}
                    >
                      <span className="admin-sell-queueItemTitle">{title}</span>
                      <span className="admin-sell-queueItemMeta">
                        {r.stock_number} · Woo #{r.source_product_id}
                        {queueTab === "posted" && r.imported_inventory_id ? ` · unit ${r.imported_inventory_id.slice(0, 8)}…` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="sell-ride-applyForm admin-sell-queueCard" aria-label="Import row detail">
          {!selected ? (
            <p className="sell-ride-applyMuted">Select a row to view details.</p>
          ) : queueTab === "posted" ? (
            <>
              <h3 className="sell-ride-applyPhotosTitle">Posted import</h3>
              <p className="sell-ride-applyMuted admin-sell-queueRejectedId">
                Queue ID: <code className="staff-code">{selected.id}</code>
              </p>
              <dl className="sell-ride-applyDl">
                <div className="sell-ride-applyDlRow">
                  <dt>Stock</dt>
                  <dd>{selected.stock_number}</dd>
                </div>
                <div className="sell-ride-applyDlRow">
                  <dt>Vehicle</dt>
                  <dd>
                    {selected.year ?? "—"} {selected.make ?? ""} {selected.model ?? ""}
                  </dd>
                </div>
                <div className="sell-ride-applyDlRow">
                  <dt>Odometer</dt>
                  <dd>{selected.odometer_km != null ? `${selected.odometer_km} km` : "—"}</dd>
                </div>
                <div className="sell-ride-applyDlRow">
                  <dt>Category</dt>
                  <dd>{selected.category}</dd>
                </div>
                <div className="sell-ride-applyDlRow">
                  <dt>Catalog unit</dt>
                  <dd>
                    {selected.imported_inventory_id ? (
                      <code className="staff-code">{selected.imported_inventory_id}</code>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                {selected.source_permalink ? (
                  <div className="sell-ride-applyDlRow">
                    <dt>Source</dt>
                    <dd>
                      <a href={selected.source_permalink} target="_blank" rel="noreferrer">
                        View on motorsportsfinancing.ca
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
              {selected.source_photo_urls.length > 0 ? (
                <>
                  <h3 className="admin-sell-queuePhotosTitle">Source images (URLs)</h3>
                  <div className="sell-ride-applyReviewGrid">
                    {selected.source_photo_urls.map((u) => (
                      <figure key={u} className="sell-ride-applyReviewFigure">
                        <img src={u} alt="" className="sell-ride-applyReviewImg" referrerPolicy="no-referrer" />
                        <figcaption className="sell-ride-applyReviewCaption">
                          {u.length > 80 ? `${u.slice(0, 80)}…` : u}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </>
              ) : null}
              <div className="sell-ride-applyActions sell-ride-applyActionsEnd">
                <button type="button" className="btn btn-secondary" onClick={() => selectRow(null)}>
                  Clear selection
                </button>
              </div>
            </>
          ) : queueTab === "skipped" ? (
            <>
              <h3 className="sell-ride-applyPhotosTitle">Skipped row</h3>
              <p className="sell-ride-applyMuted admin-sell-queueRejectedId">
                Queue ID: <code className="staff-code">{selected.id}</code>
              </p>
              <dl className="sell-ride-applyDl">
                <div className="sell-ride-applyDlRow">
                  <dt>Stock</dt>
                  <dd>{selected.stock_number}</dd>
                </div>
                <div className="sell-ride-applyDlRow">
                  <dt>Vehicle</dt>
                  <dd>
                    {selected.year ?? "—"} {selected.make ?? ""} {selected.model ?? ""}
                  </dd>
                </div>
                <div className="sell-ride-applyDlRow">
                  <dt>Category</dt>
                  <dd>{selected.category}</dd>
                </div>
              </dl>
              {actionError ? (
                <div className="sell-ride-applyErrorBanner" role="alert">
                  <p className="sell-ride-applyError">{actionError}</p>
                </div>
              ) : null}
              <div className="sell-ride-applyActions sell-ride-applyActionsEnd">
                <button type="button" className="btn btn-primary" disabled={actionBusy} onClick={() => void restoreSkipped()}>
                  {actionBusy ? "Restoring…" : "Move back to pending"}
                </button>
                <button type="button" className="btn btn-secondary" disabled={actionBusy} onClick={() => selectRow(null)}>
                  Clear selection
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="sell-ride-applyPhotosTitle">Review</h3>
              {selected.source_permalink ? (
                <p className="sell-ride-applyHint">
                  <a href={selected.source_permalink} target="_blank" rel="noreferrer">
                    Open source listing
                  </a>
                </p>
              ) : null}
              <form className="admin-sell-queueFormBlock" onSubmit={(e) => void saveEdits(e)}>
                <div className="sell-ride-applyGrid">
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="iq-stock">
                      Stock #
                    </label>
                    <input
                      id="iq-stock"
                      className="loginInput"
                      value={editStock}
                      onChange={(e) => setEditStock(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="iq-year">
                      Year
                    </label>
                    <input
                      id="iq-year"
                      className="loginInput"
                      type="number"
                      value={editYear}
                      onChange={(e) => setEditYear(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="iq-make">
                      Make
                    </label>
                    <input id="iq-make" className="loginInput" value={editMake} onChange={(e) => setEditMake(e.target.value)} required />
                  </div>
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="iq-model">
                      Model
                    </label>
                    <input id="iq-model" className="loginInput" value={editModel} onChange={(e) => setEditModel(e.target.value)} required />
                  </div>
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="iq-km">
                      Odometer (km)
                    </label>
                    <input
                      id="iq-km"
                      className="loginInput"
                      type="number"
                      min={0}
                      value={editKm}
                      onChange={(e) => setEditKm(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="iq-cat">
                      Category
                    </label>
                    <select
                      id="iq-cat"
                      className="select sell-ride-applySelect"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as VehicleCategory)}
                    >
                      {VEHICLE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {saveError ? (
                  <div className="sell-ride-applyErrorBanner" role="alert">
                    <p className="sell-ride-applyError">{saveError}</p>
                  </div>
                ) : null}
                <div className="sell-ride-applyActions sell-ride-applyActionsEnd">
                  <button type="button" className="btn btn-secondary" disabled={saving || publishing || actionBusy} onClick={() => void skipSelected()}>
                    Skip
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving || publishing || actionBusy}>
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>

              <h3 className="admin-sell-queuePhotosTitle">Source images ({selected.source_photo_urls.length})</h3>
              {selected.source_photo_urls.length === 0 ? (
                <p className="sell-ride-applyMuted">No images on this row — at least one is required to post.</p>
              ) : (
                <div className="sell-ride-applyReviewGrid">
                  {selected.source_photo_urls.map((u) => (
                    <AdminQueuePhotoTile
                      key={u}
                      src={u}
                      busy={removingPhotoUrl === u}
                      onRemove={() => void removeSourcePhoto(u)}
                    />
                  ))}
                </div>
              )}
              {photoRemoveError ? (
                <div className="sell-ride-applyErrorBanner" role="alert">
                  <p className="sell-ride-applyError">{photoRemoveError}</p>
                </div>
              ) : null}

              <h3 className="admin-sell-queuePhotosTitle">Post to catalog</h3>
              <form className="admin-sell-queueFormBlock" onSubmit={(e) => void publishSelected(e)}>
                <div className="sell-ride-applyGrid">
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="iq-cost">
                      Cost (CAD)
                    </label>
                    <input
                      id="iq-cost"
                      className="loginInput"
                      type="number"
                      min={0}
                      step="0.01"
                      value={pubCost}
                      onChange={(e) => setPubCost(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="iq-status">
                      Status
                    </label>
                    <select
                      id="iq-status"
                      className="select sell-ride-applySelect"
                      value={pubStatus}
                      onChange={(e) => setPubStatus(e.target.value as InventoryStatus)}
                    >
                      {INVENTORY_STATUS_VALUES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="sell-ride-applyHint">Uses the vehicle fields above. Images are fetched from the source URLs (CORS must allow your site).</p>
                {publishError ? (
                  <div className="sell-ride-applyErrorBanner" role="alert">
                    <p className="sell-ride-applyError">{publishError}</p>
                  </div>
                ) : null}
                <div className="sell-ride-applyActions sell-ride-applyActionsEnd">
                  <button type="submit" className="btn btn-primary" disabled={publishing || saving || actionBusy}>
                    {publishing ? "Posting…" : "Post to catalog"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
