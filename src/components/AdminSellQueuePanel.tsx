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
import { AdminSortablePhotoList } from "./AdminSortablePhotoList";
import { AdminStockDuplicateError } from "./AdminStockDuplicateError";
import { SELL_RIDE_PHOTOS_BUCKET, parseSellRideSubmissionRow, type SellRideSubmissionRow } from "../data/sellRide";
import {
  findInventoryUnitByStock,
  isStockNumberUniqueViolation,
  normalizeStockNumber,
  type StockDuplicateMatch
} from "../lib/inventoryStockDuplicate";
import {
  getSellPublishRequirements,
  sellPublishBlockerMessages,
  validateSellPublishCompliance,
  type SellPublishRequirement
} from "../lib/sellPublishCompliance";

function AdminSellPublishRequirements({ requirements }: { requirements: SellPublishRequirement[] }) {
  const pending = requirements.filter((r) => !r.ok);
  if (pending.length === 0) return null;
  return (
    <div id="sq-publish-requirements" className="admin-publishRequirements" role="status" aria-live="polite">
      <p className="admin-publishRequirementsTitle">Before you can publish</p>
      <ul className="admin-publishRequirementsList">
        {requirements.map((r) => (
          <li
            key={r.id}
            className={
              r.ok ? "admin-publishRequirementsItem admin-publishRequirementsItemDone" : "admin-publishRequirementsItem"
            }
          >
            <span className="admin-publishRequirementsMark" aria-hidden>
              {r.ok ? "✓" : "○"}
            </span>
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
import { sellRidePhotoPublicUrl } from "../lib/sellRidePhotos";
import { supabase } from "../lib/supabase";
import { adminDeleteRejectedSellRideSubmission } from "../lib/adminDeleteRejectedSellRideSubmission";
import { publishSellSubmissionRow, stockNumberForMassSellIndex } from "../lib/adminPublishSellSubmission";
import { formatAdminCount, type AdminInventoryCounts } from "../lib/adminInventoryCounts";
import { formatPhoneDisplay } from "../lib/formatPhone";
import { AdminQueueMassSubmitBar } from "./AdminQueueMassSubmitBar";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

type QueueTab = "submitted" | "rejected";

export type AdminSellQueuePanelProps = {
  /** Called after a submission is published to inventory so the catalog list can refresh. */
  onInventoryChanged?: () => void;
  queueCounts?: AdminInventoryCounts["sell"];
};

export function AdminSellQueuePanel({ onInventoryChanged, queueCounts }: AdminSellQueuePanelProps) {
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
  const [removingPhotoPath, setRemovingPhotoPath] = useState<string | null>(null);
  const [reorderingPhotos, setReorderingPhotos] = useState(false);
  const [photoRemoveError, setPhotoRemoveError] = useState<string | null>(null);

  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editMake, setEditMake] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editKm, setEditKm] = useState("");
  const [editCategory, setEditCategory] = useState<VehicleCategory>("Motorcycle");
  const [editAdminNotes, setEditAdminNotes] = useState("");

  const [pubStock, setPubStock] = useState("");
  const [pubCost, setPubCost] = useState("0");
  const [pubStatus, setPubStatus] = useState<InventoryStatus>("Available");
  const [pubVin, setPubVin] = useState("");
  const [pubHasRegistration, setPubHasRegistration] = useState(false);
  const [pubHasInsurance, setPubHasInsurance] = useState(false);
  const [pubNoRegInsurance, setPubNoRegInsurance] = useState(false);
  const [stockDuplicate, setStockDuplicate] = useState<StockDuplicateMatch | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [massSubmitting, setMassSubmitting] = useState(false);
  const [massError, setMassError] = useState<string | null>(null);
  const [massResultSummary, setMassResultSummary] = useState<string | null>(null);
  const [massStartStock, setMassStartStock] = useState("");
  const [massVin, setMassVin] = useState("none");
  const [massNoRegInsurance, setMassNoRegInsurance] = useState(true);

  const applyRowToForm = (row: SellRideSubmissionRow | null) => {
    setSaveError(null);
    setPublishError(null);
    setStockDuplicate(null);
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
      setEditAdminNotes("");
      setPubStock("");
      setPubCost("0");
      setPubStatus("Available");
      setPubVin("");
      setPubHasRegistration(false);
      setPubHasInsurance(false);
      setPubNoRegInsurance(false);
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
    setEditAdminNotes(row.admin_notes ?? "");
    setPubStock("");
    setPubCost("0");
    setPubStatus("Available");
    setPubVin("");
    setPubHasRegistration(false);
    setPubHasInsurance(false);
    setPubNoRegInsurance(false);
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

  const clearChecked = () => setCheckedIds(new Set());

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const publishRequirements = useMemo(
    () =>
      getSellPublishRequirements({
        stock: pubStock,
        vin: pubVin,
        hasRegistration: pubHasRegistration,
        hasInsurance: pubHasInsurance,
        noRegInsurance: pubNoRegInsurance,
        photoCount: selected?.photo_paths.length ?? 0,
        year: editYear,
        odometerKm: editKm,
        cost: pubCost,
        stockIsDuplicate: stockDuplicate != null
      }),
    [
      pubStock,
      pubVin,
      pubHasRegistration,
      pubHasInsurance,
      pubNoRegInsurance,
      selected?.photo_paths.length,
      editYear,
      editKm,
      pubCost,
      stockDuplicate
    ]
  );
  const publishBlockers = useMemo(() => sellPublishBlockerMessages(publishRequirements), [publishRequirements]);
  const canPublish = publishBlockers.length === 0;

  const setQueueTabAndReset = (tab: QueueTab) => {
    setQueueTab(tab);
    setSelectedId(null);
    setDeleteError(null);
    setSaveError(null);
    setPublishError(null);
    clearChecked();
    setMassError(null);
    setMassResultSummary(null);
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
        admin_notes: editAdminNotes.trim() || null
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
    setStockDuplicate(null);
    if (publishBlockers.length > 0) {
      setPublishError(`Complete the following before publishing: ${publishBlockers.join("; ")}.`);
      return;
    }
    const stock = normalizeStockNumber(pubStock);
    if (!stock) {
      setPublishError("Stock number is required.");
      return;
    }
    const vin = pubVin.trim();
    if (!vin) {
      setPublishError("VIN is required (type none if not available).");
      return;
    }
    const complianceErr = validateSellPublishCompliance({
      hasRegistration: pubHasRegistration,
      hasInsurance: pubHasInsurance,
      noRegInsurance: pubNoRegInsurance
    });
    if (complianceErr) {
      setPublishError(complianceErr);
      return;
    }
    try {
      const dup = await findInventoryUnitByStock(supabase, stock);
      if (dup) {
        setStockDuplicate(dup);
        return;
      }
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Could not verify stock number.");
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
          photo_paths: [],
          vin,
          is_customer_unit: true,
          sell_ride_submission_id: selected.id,
          has_registration: pubNoRegInsurance ? false : pubHasRegistration,
          has_insurance: pubNoRegInsurance ? false : pubHasInsurance,
          no_reg_insurance: pubNoRegInsurance
        })
        .select("*")
        .single();
      if (insErr) {
        if (isStockNumberUniqueViolation(insErr.message)) {
          const dup = await findInventoryUnitByStock(supabase, stock);
          if (dup) {
            setStockDuplicate(dup);
            return;
          }
        }
        throw new Error(insErr.message);
      }
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

  const runMassSubmit = () => {
    const targets = rows.filter((r) => checkedIds.has(r.id) && r.status === "submitted");
    if (targets.length === 0) return;

    const startStock = normalizeStockNumber(massStartStock);
    if (!startStock) {
      setMassError("Enter a starting stock number for the batch.");
      return;
    }
    const cost = Number.parseFloat(pubCost);
    if (!Number.isFinite(cost) || cost < 0) {
      setMassError("Enter a valid cost.");
      return;
    }
    const vin = massVin.trim();
    if (!vin) {
      setMassError("Enter a VIN (type none if not available).");
      return;
    }
    const complianceErr = validateSellPublishCompliance({
      hasRegistration: false,
      hasInsurance: false,
      noRegInsurance: massNoRegInsurance
    });
    if (complianceErr) {
      setMassError(complianceErr);
      return;
    }

    const ok = window.confirm(
      `Publish ${targets.length} selected submission${targets.length === 1 ? "" : "s"} to inventory?\n\n` +
        `Stock numbers run from ${startStock} (${targets.length} unit${targets.length === 1 ? "" : "s"}). ` +
        `Shared cost ($${cost}), status (${pubStatus}), and VIN (${vin}) apply. ` +
        `${massNoRegInsurance ? "No reg/insurance on file is marked for each unit." : ""}\n\n` +
        `Each row must have photos and valid year/odometer. Failures are listed in the summary.\n\n` +
        `Continue?`
    );
    if (!ok) return;

    void (async () => {
      setMassSubmitting(true);
      setMassError(null);
      setMassResultSummary(null);
      let okCount = 0;
      const failures: string[] = [];
      for (let i = 0; i < targets.length; i += 1) {
        const row = targets[i]!;
        const stock = stockNumberForMassSellIndex(startStock, i);
        const result = await publishSellSubmissionRow(supabase, row, {
          stock,
          cost,
          status: pubStatus,
          vin,
          hasRegistration: false,
          hasInsurance: false,
          noRegInsurance: massNoRegInsurance
        });
        if (result.ok) okCount += 1;
        else failures.push(`${result.stock}: ${result.error}`);
      }
      clearChecked();
      setSelectedId(null);
      applyRowToForm(null);
      await reloadCurrentTab();
      onInventoryChanged?.();
      const parts = [`Published ${okCount} of ${targets.length}.`];
      if (failures.length > 0) {
        parts.push(`Failed: ${failures.slice(0, 5).join("; ")}${failures.length > 5 ? ` (+${failures.length - 5} more)` : ""}`);
      }
      setMassResultSummary(parts.join(" "));
      setMassSubmitting(false);
    })();
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

  const removeSubmissionPhoto = async (path: string) => {
    if (!selected || (selected.status !== "submitted" && selected.status !== "rejected")) return;
    if (!window.confirm("Remove this photo from the submission? It will be deleted from storage.")) return;

    setRemovingPhotoPath(path);
    setPhotoRemoveError(null);
    const status = selected.status;
    const id = selected.id;
    const nextPaths = selected.photo_paths.filter((p) => p !== path);

    const { error: rmErr } = await supabase.storage.from(SELL_RIDE_PHOTOS_BUCKET).remove([path]);
    if (rmErr) {
      console.warn("sell-ride-photos remove:", rmErr.message);
    }

    const { error } = await supabase
      .from("sell_ride_submissions")
      .update({ photo_paths: nextPaths })
      .eq("id", id)
      .eq("status", status);
    if (error) {
      setPhotoRemoveError(error.message);
      setRemovingPhotoPath(null);
      return;
    }

    const next = await reloadCurrentTab();
    setSelectedId(id);
    if (status === "submitted") {
      applyRowToForm(next.find((r) => r.id === id) ?? null);
    }
    setRemovingPhotoPath(null);
  };

  const reorderSubmissionPhotos = async (orderedPaths: string[]) => {
    if (!selected || (selected.status !== "submitted" && selected.status !== "rejected")) return;
    if (orderedPaths.join("\0") === selected.photo_paths.join("\0")) return;

    setReorderingPhotos(true);
    setPhotoRemoveError(null);
    const status = selected.status;
    const id = selected.id;
    const { error } = await supabase
      .from("sell_ride_submissions")
      .update({ photo_paths: orderedPaths })
      .eq("id", id)
      .eq("status", status);
    setReorderingPhotos(false);
    if (error) {
      setPhotoRemoveError(error.message);
      return;
    }

    const next = await reloadCurrentTab();
    setSelectedId(id);
    if (status === "submitted") {
      applyRowToForm(next.find((r) => r.id === id) ?? null);
    }
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
          {queueCounts ? (
            <span className="admin-sell-queueQueueTabCount">{formatAdminCount(queueCounts.submitted)}</span>
          ) : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={queueTab === "rejected"}
          className={`admin-sell-queueQueueTab${queueTab === "rejected" ? " admin-sell-queueQueueTabActive" : ""}`}
          onClick={() => setQueueTabAndReset("rejected")}
        >
          Rejected
          {queueCounts ? (
            <span className="admin-sell-queueQueueTabCount">{formatAdminCount(queueCounts.rejected)}</span>
          ) : null}
        </button>
      </div>

      {loadError ? (
        <div className="sell-ride-applyErrorBanner" role="alert">
          <p className="sell-ride-applyError">{loadError}</p>
        </div>
      ) : null}

      {queueTab === "submitted" ? (
        <AdminQueueMassSubmitBar
          selectedCount={checkedIds.size}
          itemLabel="submission"
          onClearSelection={clearChecked}
          onMassSubmit={runMassSubmit}
          massSubmitting={massSubmitting}
          massError={massError}
          massResultSummary={massResultSummary}
          submitLabel="Mass publish to catalog"
        >
          <div className="admin-massSubmitBarGrid">
            <div className="form-row">
              <label className="loginLabel" htmlFor="sq-mass-start-stock">
                Starting stock #
              </label>
              <input
                id="sq-mass-start-stock"
                className="loginInput"
                value={massStartStock}
                onChange={(e) => setMassStartStock(e.target.value)}
                placeholder="e.g. 1001"
              />
            </div>
            <div className="form-row">
              <label className="loginLabel" htmlFor="sq-mass-cost">
                Cost (CAD)
              </label>
              <input
                id="sq-mass-cost"
                className="loginInput"
                type="number"
                min={0}
                step="0.01"
                value={pubCost}
                onChange={(e) => setPubCost(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="loginLabel" htmlFor="sq-mass-status">
                Status
              </label>
              <select
                id="sq-mass-status"
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
            <div className="form-row">
              <label className="loginLabel" htmlFor="sq-mass-vin">
                VIN (all units)
              </label>
              <input
                id="sq-mass-vin"
                className="loginInput"
                value={massVin}
                onChange={(e) => setMassVin(e.target.value)}
                placeholder="none"
              />
            </div>
            <div className="form-row sell-ride-applyFullWidth">
              <label className="admin-checkRow">
                <input
                  type="checkbox"
                  checked={massNoRegInsurance}
                  onChange={(e) => setMassNoRegInsurance(e.target.checked)}
                />
                No reg/insurance on file (all units)
              </label>
            </div>
          </div>
        </AdminQueueMassSubmitBar>
      ) : null}

      <div className="admin-sell-queueLayout">
        <div
          className="sell-ride-applyForm admin-sell-queueCard admin-sell-queueListPanel admin-invListPanel"
          aria-label={queueTab === "submitted" ? "Submitted applications" : "Rejected applications"}
        >
          <h3 className="sell-ride-applyPhotosTitle">{queueTab === "submitted" ? "Submitted" : "Rejected"}</h3>
          {loading ? (
            <p className="sell-ride-applyMuted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="sell-ride-applyMuted">
              {queueTab === "submitted" ? "No submissions in the queue." : "No rejected submissions."}
            </p>
          ) : (
            <div className="admin-invUnitListScroll">
              <ul className="admin-sell-queueItems">
                {rows.map((r) => {
                  const title = rowTitle(r);
                  const active = r.id === selectedId;
                  return (
                    <li key={r.id} className={queueTab === "submitted" ? "admin-sell-queueItemWithCheck" : undefined}>
                      {queueTab === "submitted" ? (
                        <input
                          type="checkbox"
                          className="admin-queueItemCheck"
                          checked={checkedIds.has(r.id)}
                          onChange={() => toggleChecked(r.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${title} for mass publish`}
                        />
                      ) : null}
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
            </div>
          )}
        </div>

        <div
          className="sell-ride-applyForm admin-sell-queueCard admin-sell-queueDetail admin-invDetailPanel"
          aria-label="Submission detail"
        >
          {!selected ? (
            <p className="sell-ride-applyMuted admin-sell-detailEmpty">Select a row to view details.</p>
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
                  <dd>
                    {selected.seller_phone ? (
                      <a href={`tel:${selected.seller_phone.replace(/\D/g, "")}`}>{formatPhoneDisplay(selected.seller_phone)}</a>
                    ) : (
                      "—"
                    )}
                  </dd>
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
                <div className="sell-ride-applyDlRow">
                  <dt>Customer note</dt>
                  <dd className="admin-sellerNoteSolid admin-sellerNoteSolidInline">
                    {selected.seller_notes?.trim() ? selected.seller_notes : "—"}
                  </dd>
                </div>
                <div className="sell-ride-applyDlRow">
                  <dt>Admin notes</dt>
                  <dd>{selected.admin_notes?.trim() ? selected.admin_notes : "—"}</dd>
                </div>
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
                  <AdminSortablePhotoList
                    variant="tile"
                    items={selected.photo_paths.map((p) => ({
                      id: p,
                      src: sellRidePhotoPublicUrl(supabase, p),
                      label: p
                    }))}
                    busy={reorderingPhotos}
                    removingId={removingPhotoPath}
                    onReorder={(orderedPaths) => void reorderSubmissionPhotos(orderedPaths)}
                    onRemove={(path) => void removeSubmissionPhoto(path)}
                  />
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
                  className="btn btn-danger"
                  disabled={deleting || restoring}
                  onClick={() => void deleteRejectedPermanent()}
                >
                  {deleting ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
            </>
          ) : (
            <div className="admin-sell-detail">
              <header className="admin-sell-detailHeader">
                <h3 className="admin-sell-detailTitle">{rowTitle(selected)}</h3>
                <p className="admin-sell-detailMeta">
                  {[editFirst, editLast].filter(Boolean).join(" ")}
                  {editPhone ? (
                    <>
                      {" · "}
                      <a className="admin-sell-detailPhone" href={`tel:${editPhone.replace(/\D/g, "")}`}>
                        {formatPhoneDisplay(editPhone)}
                      </a>
                    </>
                  ) : null}
                  {selected.submitted_at ? ` · ${new Date(selected.submitted_at).toLocaleString()}` : ""}
                </p>
              </header>

              <section className="admin-sell-detailSection" aria-labelledby="sq-review-heading">
                <h4 id="sq-review-heading" className="admin-sell-detailSectionTitle">
                  Seller &amp; vehicle
                </h4>
              <form className="admin-sell-queueFormBlock" onSubmit={(e) => void saveEdits(e)}>
                <div className="sell-ride-applyGrid admin-sell-reviewGrid">
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
                    <p className="loginLabel">Customer note</p>
                    <p className="admin-sellerNoteSolid">
                      {selected.seller_notes?.trim() ? selected.seller_notes : "—"}
                    </p>
                  </div>
                  <div className="form-row sell-ride-applyFullWidth">
                    <label className="loginLabel" htmlFor="sq-admin-notes">
                      Admin notes
                    </label>
                    <textarea
                      id="sq-admin-notes"
                      className="loginInput textarea"
                      rows={3}
                      value={editAdminNotes}
                      onChange={(e) => setEditAdminNotes(e.target.value)}
                      placeholder="Internal notes for your team"
                    />
                  </div>
                </div>
                {saveError ? (
                  <div className="sell-ride-applyErrorBanner" role="alert">
                    <p className="sell-ride-applyError">{saveError}</p>
                  </div>
                ) : null}
                <div className="sell-ride-applyActions admin-sell-detailSectionActions">
                  <button type="button" className="btn btn-secondary" disabled={saving || publishing} onClick={() => void rejectSelected()}>
                    Reject
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving || publishing}>
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
              </section>

              <section className="admin-sell-detailSection" aria-labelledby="sq-photos-heading">
              <h4 id="sq-photos-heading" className="admin-sell-detailSectionTitle">
                Photos
              </h4>
              {selected.photo_paths.length === 0 ? (
                <p className="sell-ride-applyMuted">No photos — at least one is required to publish.</p>
              ) : (
                <AdminSortablePhotoList
                  variant="tile"
                  items={selected.photo_paths.map((p) => ({
                    id: p,
                    src: sellRidePhotoPublicUrl(supabase, p),
                    label: p
                  }))}
                  busy={reorderingPhotos}
                  removingId={removingPhotoPath}
                  onReorder={(orderedPaths) => void reorderSubmissionPhotos(orderedPaths)}
                  onRemove={(path) => void removeSubmissionPhoto(path)}
                />
              )}
              {photoRemoveError ? (
                <div className="sell-ride-applyErrorBanner" role="alert">
                  <p className="sell-ride-applyError">{photoRemoveError}</p>
                </div>
              ) : null}
              </section>

              <section className="admin-sell-detailSection admin-sell-detailSectionPublish" aria-labelledby="sq-publish-heading">
              <h4 id="sq-publish-heading" className="admin-sell-detailSectionTitle">
                Publish to inventory
              </h4>
              <form className="admin-sell-queueFormBlock" onSubmit={(e) => void publishSelected(e)}>
                <div className="sell-ride-applyGrid admin-sell-publishGrid">
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
                  <div className="form-row sell-ride-applyFullWidth">
                    <label className="loginLabel" htmlFor="sq-vin">
                      VIN
                    </label>
                    <input
                      id="sq-vin"
                      className="loginInput"
                      value={pubVin}
                      onChange={(e) => setPubVin(e.target.value)}
                      placeholder="Required — type none if not available"
                      required
                    />
                  </div>
                <fieldset className="admin-publishCompliance sell-ride-applyFullWidth">
                  <legend className="loginLabel">Registration &amp; insurance</legend>
                  <label className="admin-checkRow">
                    <input
                      type="checkbox"
                      checked={pubHasRegistration}
                      disabled={pubNoRegInsurance}
                      onChange={(e) => setPubHasRegistration(e.target.checked)}
                    />
                    Registration received
                  </label>
                  <label className="admin-checkRow">
                    <input
                      type="checkbox"
                      checked={pubHasInsurance}
                      disabled={pubNoRegInsurance}
                      onChange={(e) => setPubHasInsurance(e.target.checked)}
                    />
                    Insurance received
                  </label>
                  <label className="admin-checkRow">
                    <input
                      type="checkbox"
                      checked={pubNoRegInsurance}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setPubNoRegInsurance(checked);
                        if (checked) {
                          setPubHasRegistration(false);
                          setPubHasInsurance(false);
                        }
                      }}
                    />
                    No registration / insurance on file
                  </label>
                </fieldset>
                </div>
                <p className="sell-ride-applyHint sell-ride-applyFullWidth">Photos are copied into the inventory bucket. Cost is saved on the new unit.</p>
                <AdminSellPublishRequirements requirements={publishRequirements} />
                {stockDuplicate ? <AdminStockDuplicateError stock={normalizeStockNumber(pubStock)} match={stockDuplicate} /> : null}
                {publishError ? (
                  <div className="sell-ride-applyErrorBanner" role="alert">
                    <p className="sell-ride-applyError">{publishError}</p>
                  </div>
                ) : null}
                <div className="sell-ride-applyActions admin-sell-detailSectionActions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={publishing || saving}
                    title={!canPublish ? publishBlockers.join(" · ") : undefined}
                    aria-describedby={!canPublish ? "sq-publish-requirements" : undefined}
                  >
                    {publishing ? "Publishing…" : "Publish unit"}
                  </button>
                </div>
              </form>
              </section>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
