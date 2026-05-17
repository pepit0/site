import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { INVENTORY_STATUS_VALUES, VEHICLE_CATEGORIES, type InventoryStatus, type VehicleCategory } from "../data/inventory";
import { parseInventoryImportQueueRow, type InventoryImportQueueRow, type InventoryImportQueueStatus } from "../data/inventoryImportQueue";
import { findInventoryUnitByStock, normalizeStockNumber, type StockDuplicateMatch } from "../lib/inventoryStockDuplicate";
import {
  formatMsfImportSyncSummary,
  syncMsfImportQueue,
  type MsfImportSyncSummary
} from "../lib/syncMsfImportQueue";
import { publishImportQueueRow } from "../lib/adminPublishImportRow";
import { formatAdminCount, type AdminInventoryCounts } from "../lib/adminInventoryCounts";
import { supabase } from "../lib/supabase";
import { AdminButtonBusyLabel } from "./AdminButtonBusyLabel";
import { AdminQueueMassSubmitBar } from "./AdminQueueMassSubmitBar";
import { AdminQueuePhotoTile } from "./AdminQueuePhotoTile";
import { AdminStockDuplicateError } from "./AdminStockDuplicateError";

type QueueTab = "pending" | "posted" | "skipped";

export type AdminImportQueuePanelProps = {
  onInventoryChanged?: () => void;
  queueCounts?: AdminInventoryCounts["import"];
};

function rowTitle(r: InventoryImportQueueRow): string {
  const y = r.year != null ? String(r.year) : "?";
  const mk = r.make?.trim() || "";
  const md = r.model?.trim() || "";
  const core = `${mk} ${md}`.trim();
  if (core) return `${y} ${core}`;
  return r.source_product_name?.trim() || `Woo #${r.source_product_id}`;
}

export function AdminImportQueuePanel({ onInventoryChanged, queueCounts }: AdminImportQueuePanelProps) {
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
  const [msfSyncing, setMsfSyncing] = useState(false);
  const [msfSyncError, setMsfSyncError] = useState<string | null>(null);
  const [msfSyncSummary, setMsfSyncSummary] = useState<MsfImportSyncSummary | null>(null);

  const [editStock, setEditStock] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editMake, setEditMake] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editKm, setEditKm] = useState("");
  const [editCategory, setEditCategory] = useState<VehicleCategory>("Motorcycle");

  const [pubCost, setPubCost] = useState("0");
  const [pubStatus, setPubStatus] = useState<InventoryStatus>("Available");
  const [pubAdminNotes, setPubAdminNotes] = useState("");
  const [stockDuplicate, setStockDuplicate] = useState<StockDuplicateMatch | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [massSubmitting, setMassSubmitting] = useState(false);
  const [massSkipping, setMassSkipping] = useState(false);
  const [massError, setMassError] = useState<string | null>(null);
  const [massResultSummary, setMassResultSummary] = useState<string | null>(null);

  const applyRowToForm = (row: InventoryImportQueueRow | null) => {
    setSaveError(null);
    setPublishError(null);
    setStockDuplicate(null);
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
      setPubAdminNotes("");
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
    setPubAdminNotes("");
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

  const clearChecked = () => setCheckedIds(new Set());

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pendingRows = useMemo(() => rows.filter((r) => r.status === "pending"), [rows]);
  const pendingDbTotal = queueCounts?.pending ?? null;
  const postedDbTotal = queueCounts?.posted ?? null;
  const skippedDbTotal = queueCounts?.skipped ?? null;
  const pendingListCapped = queueTab === "pending" && pendingDbTotal != null && !loading && rows.length < pendingDbTotal;
  const allPendingSelected =
    pendingRows.length > 0 && pendingRows.every((r) => checkedIds.has(r.id));
  const postAllPendingCount = pendingDbTotal ?? pendingRows.length;

  const selectAllPending = () => setCheckedIds(new Set(pendingRows.map((r) => r.id)));

  const setQueueTabAndReset = (tab: QueueTab) => {
    setQueueTab(tab);
    setSelectedId(null);
    setActionError(null);
    setSaveError(null);
    setPublishError(null);
    clearChecked();
    setMassError(null);
    setMassResultSummary(null);
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

  const runMsfSync = async () => {
    setMsfSyncError(null);
    setMsfSyncSummary(null);
    setMsfSyncing(true);
    const result = await syncMsfImportQueue(supabase);
    if (!result.ok) {
      setMsfSyncError(result.error);
    } else {
      setMsfSyncSummary(formatMsfImportSyncSummary(result.stats));
      const queueChanged = result.stats.importedNew > 0 || result.stats.removedStale > 0;
      if (queueChanged) {
        setQueueTab("pending");
        setSelectedId(null);
        applyRowToForm(null);
        await fetchRows("pending");
        onInventoryChanged?.();
      }
    }
    setMsfSyncing(false);
  };

  const publishSelected = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || selected.status !== "pending") return;
    setPublishError(null);
    setStockDuplicate(null);
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
    const stock = normalizeStockNumber(editStock);
    if (!stock) {
      setPublishError("Stock number is required.");
      return;
    }
    if (!editMake.trim() || !editModel.trim()) {
      setPublishError("Make and model are required.");
      return;
    }

    const rowToPublish: InventoryImportQueueRow = {
      ...selected,
      stock_number: stock,
      year,
      make: editMake.trim(),
      model: editModel.trim(),
      odometer_km,
      category: editCategory
    };

    setPublishing(true);
    const result = await publishImportQueueRow(supabase, rowToPublish, {
      cost,
      status: pubStatus,
      adminNotes: pubAdminNotes.trim() || null
    });
    if (result.ok) {
      setSelectedId(null);
      applyRowToForm(null);
      await reloadCurrentTab();
      onInventoryChanged?.();
    } else {
      setPublishError(result.error);
      if (result.error.includes("already in catalog")) {
        const dup = await findInventoryUnitByStock(supabase, result.stock);
        if (dup) setStockDuplicate(dup);
      }
    }
    setPublishing(false);
  };

  const executeMassPost = (targets: InventoryImportQueueRow[], confirmLabel: "selected" | "all pending") => {
    if (targets.length === 0) return;

    const cost = Number.parseFloat(pubCost);
    if (!Number.isFinite(cost) || cost < 0) {
      setMassError("Enter a valid cost in the mass post settings.");
      return;
    }

    const countLabel =
      confirmLabel === "all pending"
        ? `all ${targets.length} pending import${targets.length === 1 ? "" : "s"}`
        : `${targets.length} selected import${targets.length === 1 ? "" : "s"}`;

    const ok = window.confirm(
      `Post ${countLabel} to the catalog?\n\n` +
        `Each row uses its queue stock # and vehicle fields. Shared cost ($${cost}) and status (${pubStatus}) apply. ` +
        `Photos are downloaded from MSF source URLs.\n\n` +
        `This cannot be undone in one step. Rows that fail (duplicate stock, missing photos) are listed in the summary.\n\n` +
        `Continue?`
    );
    if (!ok) return;

    void (async () => {
      setMassSubmitting(true);
      setMassError(null);
      setMassResultSummary(null);
      let okCount = 0;
      const failures: string[] = [];
      for (const row of targets) {
        const result = await publishImportQueueRow(supabase, row, {
          cost,
          status: pubStatus,
          adminNotes: pubAdminNotes.trim() || null
        });
        if (result.ok) okCount += 1;
        else failures.push(`${result.stock}: ${result.error}`);
      }
      clearChecked();
      setSelectedId(null);
      applyRowToForm(null);
      await reloadCurrentTab();
      onInventoryChanged?.();
      const parts = [`Posted ${okCount} of ${targets.length}.`];
      if (failures.length > 0) {
        parts.push(`Failed: ${failures.slice(0, 5).join("; ")}${failures.length > 5 ? ` (+${failures.length - 5} more)` : ""}`);
      }
      setMassResultSummary(parts.join(" "));
      setMassSubmitting(false);
    })();
  };

  const runMassSubmit = () => {
    executeMassPost(
      rows.filter((r) => checkedIds.has(r.id) && r.status === "pending"),
      "selected"
    );
  };

  const postAllPending = () => {
    if (pendingListCapped && pendingDbTotal != null) {
      const ok = window.confirm(
        `Only ${formatAdminCount(rows.length)} pending rows are loaded here (database has ${formatAdminCount(pendingDbTotal)}).\n\n` +
          `This run will post the loaded rows only. Refresh counts after each batch; run again until Pending reaches 0.\n\n` +
          `Continue?`
      );
      if (!ok) return;
    }
    executeMassPost(pendingRows, "all pending");
  };

  const runMassSkip = () => {
    const targets = rows.filter((r) => checkedIds.has(r.id) && r.status === "pending");
    if (targets.length === 0) return;

    const ok = window.confirm(
      `Skip ${targets.length} selected import${targets.length === 1 ? "" : "s"}?\n\n` +
        `They move to the Skipped tab and can be restored to pending later.\n\n` +
        `Continue?`
    );
    if (!ok) return;

    void (async () => {
      setMassSkipping(true);
      setMassError(null);
      setMassResultSummary(null);
      const ids = targets.map((r) => r.id);
      const { error } = await supabase
        .from("inventory_import_queue")
        .update({ status: "skipped" })
        .in("id", ids)
        .eq("status", "pending");
      if (error) {
        setMassError(error.message);
      } else {
        clearChecked();
        setSelectedId(null);
        applyRowToForm(null);
        await reloadCurrentTab();
        setMassResultSummary(`Skipped ${targets.length} import${targets.length === 1 ? "" : "s"}.`);
      }
      setMassSkipping(false);
    })();
  };

  return (
    <section className="admin-sell-queueIntegrated" aria-labelledby="admin-import-heading">
      <div className="admin-importQueueHeading">
        <h2 id="admin-import-heading" className="sell-ride-applySectionTitle admin-sell-queueIntegratedTitle">
          MSF import queue
        </h2>
        <div className="admin-importQueueHeadingActions">
          <button
            type="button"
            className="btn btn-secondary admin-importSyncBtn"
            disabled={msfSyncing || publishing || actionBusy || massSubmitting || massSkipping}
            onClick={() => void runMsfSync()}
          >
            {msfSyncing ? "Importing…" : "Import new units"}
          </button>
          {queueTab === "pending" && pendingRows.length > 0 ? (
            <button
              type="button"
              className="btn btn-primary admin-importSyncBtn"
              disabled={msfSyncing || publishing || actionBusy || massSubmitting || massSkipping || loading}
              onClick={postAllPending}
            >
              {massSubmitting ? (
                <AdminButtonBusyLabel>Posting…</AdminButtonBusyLabel>
              ) : (
                `Post all pending (${formatAdminCount(postAllPendingCount)})`
              )}
            </button>
          ) : null}
        </div>
      </div>
      <p className="admin-invPanelIntro">
        Pull new listings from motorsportsfinancing.ca into the pending queue. Units already in your catalog or already
        posted from the queue are skipped (no duplicates). Review each row, then post to the catalog.
      </p>
      {msfSyncSummary ? (
        <div className="admin-importSyncSummary" role="status" aria-live="polite">
          <p className="admin-importSyncSuccessLead">{msfSyncSummary.headline}</p>
          {msfSyncSummary.ignoredLines.length > 0 ? (
            <ul className="admin-importSyncSummaryList">
              {msfSyncSummary.ignoredLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {msfSyncSummary.extraLines.map((line) => (
            <p key={line} className="admin-importSyncSummaryExtra">
              {line}
            </p>
          ))}
        </div>
      ) : null}
      {msfSyncError ? (
        <div className="sell-ride-applyErrorBanner" role="alert">
          <p className="sell-ride-applyError">{msfSyncError}</p>
        </div>
      ) : null}

      <div className="admin-sell-queueQueueTabs" role="tablist" aria-label="Import queue status">
        <button
          type="button"
          role="tab"
          aria-selected={queueTab === "pending"}
          className={`admin-sell-queueQueueTab${queueTab === "pending" ? " admin-sell-queueQueueTabActive" : ""}`}
          onClick={() => setQueueTabAndReset("pending")}
        >
          Pending
          {pendingDbTotal != null ? (
            <span className="admin-sell-queueQueueTabCount">{formatAdminCount(pendingDbTotal)}</span>
          ) : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={queueTab === "posted"}
          className={`admin-sell-queueQueueTab${queueTab === "posted" ? " admin-sell-queueQueueTabActive" : ""}`}
          onClick={() => setQueueTabAndReset("posted")}
        >
          Posted
          {postedDbTotal != null ? (
            <span className="admin-sell-queueQueueTabCount">{formatAdminCount(postedDbTotal)}</span>
          ) : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={queueTab === "skipped"}
          className={`admin-sell-queueQueueTab${queueTab === "skipped" ? " admin-sell-queueQueueTabActive" : ""}`}
          onClick={() => setQueueTabAndReset("skipped")}
        >
          Skipped
          {skippedDbTotal != null ? (
            <span className="admin-sell-queueQueueTabCount">{formatAdminCount(skippedDbTotal)}</span>
          ) : null}
        </button>
      </div>

      {loadError ? (
        <div className="sell-ride-applyErrorBanner" role="alert">
          <p className="sell-ride-applyError">{loadError}</p>
        </div>
      ) : null}

      {queueTab === "pending" && pendingRows.length > 0 && checkedIds.size === 0 ? (
        <div className="admin-importMassPostDefaults" role="region" aria-label="Mass post settings">
          <p className="sell-ride-applyHint admin-importMassPostDefaultsLead">
            Set cost and status for <strong>Post all pending</strong> or after you select rows.
          </p>
          <div className="admin-massSubmitBarGrid">
            <div className="form-row">
              <label className="loginLabel" htmlFor="iq-mass-cost-all">
                Cost (CAD)
              </label>
              <input
                id="iq-mass-cost-all"
                className="loginInput"
                type="number"
                min={0}
                step="0.01"
                value={pubCost}
                onChange={(e) => setPubCost(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="loginLabel" htmlFor="iq-mass-status-all">
                Status
              </label>
              <select
                id="iq-mass-status-all"
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
          {massError ? (
            <div className="sell-ride-applyErrorBanner admin-massSubmitBarMessage" role="alert">
              <p className="sell-ride-applyError">{massError}</p>
            </div>
          ) : null}
          {massResultSummary ? (
            <p className="admin-massSubmitBarSummary" role="status">
              {massResultSummary}
            </p>
          ) : null}
        </div>
      ) : null}

      {queueTab === "pending" ? (
        <AdminQueueMassSubmitBar
          selectedCount={checkedIds.size}
          itemLabel="pending import"
          onClearSelection={clearChecked}
          onMassSubmit={runMassSubmit}
          onMassSkip={runMassSkip}
          massSubmitting={massSubmitting}
          massSkipping={massSkipping}
          massError={checkedIds.size > 0 ? massError : null}
          massResultSummary={checkedIds.size > 0 ? massResultSummary : null}
          submitLabel="Mass post to catalog"
          skipLabel="Skip selected"
        >
          <div className="admin-massSubmitBarGrid">
            <div className="form-row">
              <label className="loginLabel" htmlFor="iq-mass-cost">
                Cost (CAD)
              </label>
              <input
                id="iq-mass-cost"
                className="loginInput"
                type="number"
                min={0}
                step="0.01"
                value={pubCost}
                onChange={(e) => setPubCost(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="loginLabel" htmlFor="iq-mass-status">
                Status
              </label>
              <select
                id="iq-mass-status"
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
        </AdminQueueMassSubmitBar>
      ) : null}

      <div className="admin-sell-queueLayout">
        <div
          className="sell-ride-applyForm admin-sell-queueCard admin-sell-queueListPanel admin-invListPanel"
          aria-label="Import queue list"
        >
          <div className="admin-importPendingListHead">
            <h3 className="sell-ride-applyPhotosTitle">
              {queueTab === "pending" ? "Pending" : queueTab === "posted" ? "Posted" : "Skipped"}
            </h3>
            {queueTab === "pending" && pendingRows.length > 0 ? (
              <button
                type="button"
                className="btn btn-secondary admin-invMiniBtn"
                disabled={massSubmitting || massSkipping}
                onClick={() => (allPendingSelected ? clearChecked() : selectAllPending())}
              >
                {allPendingSelected ? "Deselect all" : `Select all (${pendingRows.length})`}
              </button>
            ) : null}
          </div>
          {pendingListCapped ? (
            <p className="sell-ride-applyHint admin-invListCapHint" role="status">
              Showing {formatAdminCount(rows.length)} of {formatAdminCount(pendingDbTotal)} pending in the list. Total
              posted from MSF: {formatAdminCount(postedDbTotal)}. Use counts above the tabs for full database totals.
            </p>
          ) : null}
          {loading ? (
            <p className="sell-ride-applyMuted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="sell-ride-applyMuted">No rows in this queue.</p>
          ) : (
            <div className="admin-invUnitListScroll">
              <ul className="admin-sell-queueItems">
              {rows.map((r) => {
                const title = rowTitle(r);
                const active = r.id === selectedId;
                return (
                  <li key={r.id} className={queueTab === "pending" ? "admin-sell-queueItemWithCheck" : undefined}>
                    {queueTab === "pending" ? (
                      <input
                        type="checkbox"
                        className="admin-queueItemCheck"
                        checked={checkedIds.has(r.id)}
                        onChange={() => toggleChecked(r.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${title} for mass post`}
                      />
                    ) : null}
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
            </div>
          )}
        </div>

        <div
          className="sell-ride-applyForm admin-sell-queueCard admin-sell-queueDetail admin-invDetailPanel"
          aria-label="Import row detail"
        >
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
              {selected.source_photo_urls.length > 0 ? (
                <>
                  <h3 className="admin-sell-queuePhotosTitle">Source images</h3>
                  <div className="sell-ride-applyReviewGrid">
                    {selected.source_photo_urls.map((u) => (
                      <figure key={u} className="sell-ride-applyReviewFigure">
                        <img src={u} alt="" className="sell-ride-applyReviewImg" referrerPolicy="no-referrer" />
                      </figure>
                    ))}
                  </div>
                </>
              ) : (
                <p className="sell-ride-applyMuted">No source images on this row.</p>
              )}
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
                  <div className="form-row sell-ride-applyFullWidth">
                    <label className="loginLabel" htmlFor="iq-admin-notes">
                      Internal notes
                    </label>
                    <textarea
                      id="iq-admin-notes"
                      className="loginInput textarea"
                      rows={3}
                      value={pubAdminNotes}
                      onChange={(e) => setPubAdminNotes(e.target.value)}
                      placeholder="Admin-only — not shown on the public listing"
                    />
                  </div>
                </div>
                <p className="sell-ride-applyHint">Uses the vehicle fields above. Images are fetched from the source URLs (CORS must allow your site).</p>
                {stockDuplicate ? <AdminStockDuplicateError stock={normalizeStockNumber(editStock)} match={stockDuplicate} /> : null}
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
