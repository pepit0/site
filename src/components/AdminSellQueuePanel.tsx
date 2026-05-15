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
import { SELL_RIDE_PHOTOS_BUCKET, parseSellRideSubmissionRow, type SellRideSubmissionRow } from "../data/sellRide";
import { sellRidePhotoPublicUrl } from "../lib/sellRidePhotos";
import { supabase } from "../lib/supabase";
import { adminDeleteRejectedSellRideSubmission } from "../lib/adminDeleteRejectedSellRideSubmission";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

type QueueTab = "submitted" | "rejected";

export type AdminSellQueuePanelProps = {
  /** Called after a submission is published to inventory so the catalog list can refresh. */
  onInventoryChanged?: () => void;
};

export function AdminSellQueuePanel({ onInventoryChanged }: AdminSellQueuePanelProps) {
  const [queueTab, setQueueTab] = useState<QueueTab>("submitted");
  const [rows, setRows] = useState<SellRideSubmissionRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editMake, setEditMake] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editKm, setEditKm] = useState("");
  const [editCategory, setEditCategory] = useState<VehicleCategory>("Motorcycle");
  const [editNotes, setEditNotes] = useState("");

  const [pubStock, setPubStock] = useState("");
  const [pubCost, setPubCost] = useState("0");
  const [pubStatus, setPubStatus] = useState<InventoryStatus>("Available");

  const applyRowToForm = (row: SellRideSubmissionRow | null) => {
    setSaveError(null);
    setPublishError(null);
    if (!row) {
      setEditFirst("");
      setEditLast("");
      setEditPhone("");
      setEditEmail("");
      setEditYear("");
      setEditMake("");
      setEditModel("");
      setEditKm("");
      setEditCategory("Motorcycle");
      setEditNotes("");
      setPubStock("");
      setPubCost("0");
      setPubStatus("Available");
      return;
    }
    setEditFirst(row.seller_first_name ?? "");
    setEditLast(row.seller_last_name ?? "");
    setEditPhone(row.seller_phone ?? "");
    setEditEmail(row.seller_email ?? "");
    setEditYear(row.year != null ? String(row.year) : "");
    setEditMake(row.make ?? "");
    setEditModel(row.model ?? "");
    setEditKm(row.odometer_km != null ? String(row.odometer_km) : "");
    setEditCategory(row.category ?? "Motorcycle");
    setEditNotes(row.seller_notes ?? "");
    setPubStock("");
    setPubCost("0");
    setPubStatus("Available");
  };

  const fetchRows = useCallback(async (tab: QueueTab): Promise<SellRideSubmissionRow[]> => {
    setLoading(true);
    setLoadError(null);
    const statusFilter = tab === "submitted" ? "submitted" : "rejected";
    const orderCol = tab === "submitted" ? "submitted_at" : "updated_at";
    const { data, error } = await supabase
      .from("sell_ride_submissions")
      .select("*")
      .eq("status", statusFilter)
      .order(orderCol, { ascending: false, nullsFirst: false });
    let parsed: SellRideSubmissionRow[] = [];
    if (error) {
      setLoadError(error.message);
      setRows([]);
    } else {
      parsed = (data ?? [])
        .map((r) => parseSellRideSubmissionRow(r))
        .filter((r): r is SellRideSubmissionRow => r != null && r.status === statusFilter);
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
    setDeleteError(null);
    setSaveError(null);
    setPublishError(null);
    applyRowToForm(null);
  };

  const selectRow = (id: string | null) => {
    setSelectedId(id);
    if (queueTab === "submitted") {
      const row = id ? rows.find((r) => r.id === id) ?? null : null;
      applyRowToForm(row);
    } else {
      setDeleteError(null);
      applyRowToForm(null);
    }
  };

  const saveEdits = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || selected.status !== "submitted") return;
    setSaveError(null);
    const year = Number.parseInt(editYear, 10);
    if (!Number.isFinite(year) || year < 1900 || year > 2100) {
      setSaveError("Enter a valid year.");
      return;
    }
    const km = Number.parseInt(editKm, 10);
    if (!Number.isFinite(km) || km < 0) {
      setSaveError("Enter a valid odometer (km).");
      return;
    }
    if (!editFirst.trim() || !editLast.trim() || !editPhone.trim() || !editMake.trim() || !editModel.trim()) {
      setSaveError("Name, phone, make, and model are required.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("sell_ride_submissions")
      .update({
        seller_first_name: editFirst.trim(),
        seller_last_name: editLast.trim(),
        seller_phone: editPhone.trim().replace(/\D/g, ""),
        seller_email: editEmail.trim() ? editEmail.trim().toLowerCase() : null,
        year,
        make: editMake.trim(),
        model: editModel.trim(),
        odometer_km: km,
        category: editCategory,
        seller_notes: editNotes.trim() || null
      })
      .eq("id", selected.id)
      .eq("status", "submitted");
    if (error) {
      setSaveError(error.message);
    } else {
      const next = await reloadCurrentTab();
      const sid = selected.id;
      applyRowToForm(next.find((x) => x.id === sid) ?? null);
    }
    setSaving(false);
  };

  const rejectSelected = async () => {
    if (!selected || selected.status !== "submitted") return;
    const reason = window.prompt("Reason for rejection (optional):") ?? "";
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase
      .from("sell_ride_submissions")
      .update({ status: "rejected", rejected_reason: reason.trim() || null })
      .eq("id", selected.id)
      .eq("status", "submitted");
    if (error) {
      setSaveError(error.message);
    } else {
      setSelectedId(null);
      applyRowToForm(null);
      await reloadCurrentTab();
    }
    setSaving(false);
  };

  const publishSelected = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || selected.status !== "submitted") return;
    setPublishError(null);
    const stock = pubStock.trim();
    if (!stock) {
      setPublishError("Stock number is required.");
      return;
    }
    const cost = Number.parseFloat(pubCost);
    if (!Number.isFinite(cost) || cost < 0) {
      setPublishError("Enter a valid cost.");
      return;
    }
    const year = Number.parseInt(editYear, 10);
    const km = Number.parseInt(editKm, 10);
    if (!Number.isFinite(year) || !Number.isFinite(km)) {
      setPublishError("Fix year and odometer before publishing.");
      return;
    }
    if (selected.photo_paths.length < 1) {
      setPublishError("Submission has no photos.");
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
          odometer_km: km,
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

      for (const oldPath of selected.photo_paths) {
        const { data: blob, error: dlErr } = await supabase.storage.from(SELL_RIDE_PHOTOS_BUCKET).download(oldPath);
        if (dlErr || !blob) throw new Error(dlErr?.message ?? "Download failed.");
        const baseName = oldPath.includes("/") ? oldPath.slice(oldPath.lastIndexOf("/") + 1) : oldPath;
        const nextPath = `${unitId}/${sanitizeFileName(baseName)}`;
        const { error: upErr } = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).upload(nextPath, blob, {
          cacheControl: "3600",
          upsert: false
        });
        if (upErr) throw new Error(upErr.message);
        newPaths.push(nextPath);
      }

      const { error: upRowErr } = await supabase
        .from("inventory_units")
        .update({ photo_paths: newPaths })
        .eq("id", unitId);
      if (upRowErr) throw new Error(upRowErr.message);

      const { error: subErr } = await supabase
        .from("sell_ride_submissions")
        .update({ status: "published", published_inventory_id: unitId })
        .eq("id", selected.id)
        .eq("status", "submitted");
      if (subErr) throw new Error(subErr.message);

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

  const deleteRejectedPermanent = async () => {
    if (!selected || selected.status !== "rejected") return;
    if (
      !window.confirm(
        "Permanently delete this rejected submission and remove its photos from storage? This cannot be undone."
      )
    ) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    const id = selected.id;
    const photoPaths = [...selected.photo_paths];
    try {
      const del = await adminDeleteRejectedSellRideSubmission(id);
      if (!del.ok) throw new Error(del.error);
      if (photoPaths.length > 0) {
        const { error: rmErr } = await supabase.storage.from(SELL_RIDE_PHOTOS_BUCKET).remove(photoPaths);
        if (rmErr) {
          console.warn("sell-ride-photos remove:", rmErr.message);
        }
      }
      setSelectedId(null);
      await reloadCurrentTab();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed.");
    }
    setDeleting(false);
  };

  const restoreRejectedToSubmitted = async () => {
    if (!selected || selected.status !== "rejected") return;
    if (
      !window.confirm(
        "Move this submission back to the submitted queue? You can edit and publish it again. The reject reason will be cleared."
      )
    ) {
      return;
    }
    setRestoring(true);
    setDeleteError(null);
    const id = selected.id;
    const { error } = await supabase
      .from("sell_ride_submissions")
      .update({ status: "submitted", rejected_reason: null })
      .eq("id", id)
      .eq("status", "rejected");
    if (error) {
      setDeleteError(error.message);
      setRestoring(false);
      return;
    }
    setQueueTab("submitted");
    const next = await fetchRows("submitted");
    setSelectedId(id);
    applyRowToForm(next.find((r) => r.id === id) ?? null);
    setRestoring(false);
  };

  const rowTitle = (r: SellRideSubmissionRow) =>
    r.year != null && r.make && r.model ? `${r.year} ${r.make} ${r.model}` : "Incomplete title";

  return (
    <section className="admin-sell-queueIntegrated" aria-labelledby="admin-sell-heading">
      <h2 id="admin-sell-heading" className="sell-ride-applySectionTitle admin-sell-queueIntegratedTitle">
        Sell your ride queue
      </h2>
      <p className="admin-invPanelIntro">
        {`Contact the seller, collect driver's licence and registration to confirm ownership, negotiate the bottom line, then publish to inventory when ready.`}
      </p>

      <div className="admin-sell-queueQueueTabs" role="tablist" aria-label="Queue type">
        <button
          type="button"
          role="tab"
          aria-selected={queueTab === "submitted"}
          className={`admin-sell-queueQueueTab${queueTab === "submitted" ? " admin-sell-queueQueueTabActive" : ""}`}
          onClick={() => setQueueTabAndReset("submitted")}
        >
          Submitted
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={queueTab === "rejected"}
          className={`admin-sell-queueQueueTab${queueTab === "rejected" ? " admin-sell-queueQueueTabActive" : ""}`}
          onClick={() => setQueueTabAndReset("rejected")}
        >
          Rejected
        </button>
      </div>

      {loadError ? (
        <div className="sell-ride-applyErrorBanner" role="alert">
          <p className="sell-ride-applyError">{loadError}</p>
        </div>
      ) : null}

      <div className="admin-sell-queueLayout">
        <div className="sell-ride-applyForm admin-sell-queueCard" aria-label={queueTab === "submitted" ? "Submitted applications" : "Rejected applications"}>
          <h3 className="sell-ride-applyPhotosTitle">{queueTab === "submitted" ? "Submitted" : "Rejected"}</h3>
          {loading ? (
            <p className="sell-ride-applyMuted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="sell-ride-applyMuted">
              {queueTab === "submitted" ? "No submissions in the queue." : "No rejected submissions."}
            </p>
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
                        {r.seller_first_name} {r.seller_last_name} ·{" "}
                        {queueTab === "submitted" && r.submitted_at
                          ? new Date(r.submitted_at).toLocaleString()
                          : new Date(r.updated_at).toLocaleString()}
                        {queueTab === "rejected" && r.rejected_reason ? ` · ${r.rejected_reason}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="sell-ride-applyForm admin-sell-queueCard" aria-label="Submission detail">
          {!selected ? (
            <p className="sell-ride-applyMuted">Select a row to view details.</p>
          ) : queueTab === "rejected" ? (
            <>
              <h3 className="sell-ride-applyPhotosTitle">Rejected submission</h3>
              <p className="sell-ride-applyMuted admin-sell-queueRejectedId">
                ID: <code className="staff-code">{selected.id}</code>
              </p>
              <dl className="sell-ride-applyDl">
                <div className="sell-ride-applyDlRow">
                  <dt>Name</dt>
                  <dd>
                    {selected.seller_first_name ?? "—"} {selected.seller_last_name ?? ""}
                  </dd>
                </div>
                <div className="sell-ride-applyDlRow">
                  <dt>Phone</dt>
                  <dd>{selected.seller_phone ?? "—"}</dd>
                </div>
                <div className="sell-ride-applyDlRow">
                  <dt>Email</dt>
                  <dd>{selected.seller_email ?? "—"}</dd>
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
                  <dd>{selected.category ?? "—"}</dd>
                </div>
                {selected.seller_notes ? (
                  <div className="sell-ride-applyDlRow">
                    <dt>Notes</dt>
                    <dd>{selected.seller_notes}</dd>
                  </div>
                ) : null}
                <div className="sell-ride-applyDlRow">
                  <dt>Submitted</dt>
                  <dd>{selected.submitted_at ? new Date(selected.submitted_at).toLocaleString() : "—"}</dd>
                </div>
                <div className="sell-ride-applyDlRow">
                  <dt>Reject reason</dt>
                  <dd>{selected.rejected_reason?.trim() ? selected.rejected_reason : "—"}</dd>
                </div>
              </dl>

              {selected.photo_paths.length > 0 ? (
                <>
                  <h3 className="admin-sell-queuePhotosTitle">Photos</h3>
                  <div className="sell-ride-applyReviewGrid">
                    {selected.photo_paths.map((p) => (
                      <figure key={p} className="sell-ride-applyReviewFigure">
                        <img src={sellRidePhotoPublicUrl(supabase, p)} alt="" className="sell-ride-applyReviewImg" />
                        <figcaption className="sell-ride-applyReviewCaption">{p}</figcaption>
                      </figure>
                    ))}
                  </div>
                </>
              ) : null}

              {deleteError ? (
                <div className="sell-ride-applyErrorBanner" role="alert">
                  <p className="sell-ride-applyError">{deleteError}</p>
                </div>
              ) : null}
              <div className="sell-ride-applyActions admin-sell-queueRejectedActions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={deleting || restoring}
                  onClick={() => void restoreRejectedToSubmitted()}
                >
                  {restoring ? "Restoring…" : "Restore to submitted queue"}
                </button>
                <button type="button" className="btn btn-secondary" disabled={deleting || restoring} onClick={() => selectRow(null)}>
                  Clear selection
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={deleting || restoring}
                  onClick={() => void deleteRejectedPermanent()}
                >
                  {deleting ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="sell-ride-applyPhotosTitle">Review</h3>
              <form className="admin-sell-queueFormBlock" onSubmit={(e) => void saveEdits(e)}>
                <div className="sell-ride-applyGrid">
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="sq-first">
                      First name
                    </label>
                    <input
                      id="sq-first"
                      className="loginInput"
                      value={editFirst}
                      onChange={(e) => setEditFirst(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="sq-last">
                      Last name
                    </label>
                    <input
                      id="sq-last"
                      className="loginInput"
                      value={editLast}
                      onChange={(e) => setEditLast(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="sq-phone">
                      Phone (digits ok)
                    </label>
                    <input
                      id="sq-phone"
                      className="loginInput"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="sq-email">
                      Email
                    </label>
                    <input
                      id="sq-email"
                      className="loginInput"
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                    />
                  </div>
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="sq-year">
                      Year
                    </label>
                    <input
                      id="sq-year"
                      className="loginInput"
                      type="number"
                      value={editYear}
                      onChange={(e) => setEditYear(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="sq-make">
                      Make
                    </label>
                    <input
                      id="sq-make"
                      className="loginInput"
                      value={editMake}
                      onChange={(e) => setEditMake(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="sq-model">
                      Model
                    </label>
                    <input
                      id="sq-model"
                      className="loginInput"
                      value={editModel}
                      onChange={(e) => setEditModel(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="sq-km">
                      Odometer (km)
                    </label>
                    <input
                      id="sq-km"
                      className="loginInput"
                      type="number"
                      min={0}
                      value={editKm}
                      onChange={(e) => setEditKm(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="sq-cat">
                      Category
                    </label>
                    <select
                      id="sq-cat"
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
                  <div className="form-row sell-ride-applyFullWidth">
                    <label className="loginLabel" htmlFor="sq-notes">
                      Notes
                    </label>
                    <textarea
                      id="sq-notes"
                      className="loginInput textarea"
                      rows={3}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                    />
                  </div>
                </div>
                {saveError ? (
                  <div className="sell-ride-applyErrorBanner" role="alert">
                    <p className="sell-ride-applyError">{saveError}</p>
                  </div>
                ) : null}
                <div className="sell-ride-applyActions sell-ride-applyActionsEnd">
                  <button type="button" className="btn btn-secondary" disabled={saving || publishing} onClick={() => void rejectSelected()}>
                    Reject
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving || publishing}>
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>

              <h3 className="admin-sell-queuePhotosTitle">Photos</h3>
              <div className="sell-ride-applyReviewGrid">
                {selected.photo_paths.map((p) => (
                  <figure key={p} className="sell-ride-applyReviewFigure">
                    <img src={sellRidePhotoPublicUrl(supabase, p)} alt="" className="sell-ride-applyReviewImg" />
                    <figcaption className="sell-ride-applyReviewCaption">{p}</figcaption>
                  </figure>
                ))}
              </div>

              <h3 className="admin-sell-queuePhotosTitle">Publish to inventory</h3>
              <form className="admin-sell-queueFormBlock" onSubmit={(e) => void publishSelected(e)}>
                <div className="sell-ride-applyGrid">
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="sq-stock">
                      Stock #
                    </label>
                    <input
                      id="sq-stock"
                      className="loginInput"
                      value={pubStock}
                      onChange={(e) => setPubStock(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label className="loginLabel" htmlFor="sq-cost">
                      Cost (CAD)
                    </label>
                    <input
                      id="sq-cost"
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
                    <label className="loginLabel" htmlFor="sq-status">
                      Status
                    </label>
                    <select
                      id="sq-status"
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
                <p className="sell-ride-applyHint">Photos are copied into the inventory bucket. Cost is saved on the new unit.</p>
                {publishError ? (
                  <div className="sell-ride-applyErrorBanner" role="alert">
                    <p className="sell-ride-applyError">{publishError}</p>
                  </div>
                ) : null}
                <div className="sell-ride-applyActions sell-ride-applyActionsEnd">
                  <button type="submit" className="btn btn-primary" disabled={publishing || saving}>
                    {publishing ? "Publishing…" : "Publish unit"}
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
