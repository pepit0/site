import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { INVENTORY_STATUS_VALUES, VEHICLE_CATEGORIES, type InventoryStatus, type VehicleCategory } from "../data/inventory";
import { parseInventoryImportQueueRow, type InventoryImportQueueRow, type InventoryImportQueueStatus } from "../data/inventoryImportQueue";
import { findInventoryUnitByStock, normalizeStockNumber, type StockDuplicateMatch } from "../lib/inventoryStockDuplicate";
import { publishImportQueueRow } from "../lib/adminPublishImportRow";
import {
  formatUsImportSummary,
  importUsDealerInventory,
  type UsImportCategoryCounts,
  type UsImportSummary
} from "../lib/importUsDealerInventory";
import {
  formatOverlandramImportSyncSummary,
  syncOverlandramImportQueue,
  type OverlandramImportSyncSummary
} from "../lib/syncOverlandramImportQueue";
import { formatAdminCount, type AdminInventoryCounts } from "../lib/adminInventoryCounts";
import { findStockConflict, stockConflictMessage } from "../lib/tmsStockNumber";
import {
  estimateUsImportSearchProgress,
  usImportSearchCompleteProgress
} from "../lib/usImportSearchProgress";
import { importUrlToQueue, type ImportUrlPreview } from "../lib/importUrlToQueue";
import { supabase } from "../lib/supabase";
import { AdminMassPostProgress, type AdminMassPostProgressProps } from "./AdminMassPostProgress";
import { AdminQueueMassSubmitBar } from "./AdminQueueMassSubmitBar";
import { AdminSortablePhotoList } from "./AdminSortablePhotoList";
import { AdminStockDuplicateError } from "./AdminStockDuplicateError";
import { AdminUsImportModal } from "./AdminUsImportModal";
import { AdminImportUrlModal } from "./AdminImportUrlModal";

type QueueTab = "pending" | "posted" | "skipped";
type PostedView = "in-catalog" | "removed";

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
  return r.source_product_name?.trim() || `Source #${r.source_product_id}`;
}

export function AdminImportQueuePanel({ onInventoryChanged, queueCounts }: AdminImportQueuePanelProps) {
  const [queueTab, setQueueTab] = useState<QueueTab>("pending");
  const [postedView, setPostedView] = useState<PostedView>("in-catalog");
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
  const [deleting, setDeleting] = useState(false);
  const [removingPhotoUrl, setRemovingPhotoUrl] = useState<string | null>(null);
  const [reorderingPhotos, setReorderingPhotos] = useState(false);
  const [photoRemoveError, setPhotoRemoveError] = useState<string | null>(null);
  const [importSyncing, setImportSyncing] = useState(false);
  const [importSyncError, setImportSyncError] = useState<string | null>(null);
  const [importSyncSummary, setImportSyncSummary] = useState<OverlandramImportSyncSummary | null>(null);
  const [usImportOpen, setUsImportOpen] = useState(false);
  const [usImporting, setUsImporting] = useState(false);
  const [usImportError, setUsImportError] = useState<string | null>(null);
  const [usImportSummary, setUsImportSummary] = useState<UsImportSummary | null>(null);
  const [usImportProgress, setUsImportProgress] = useState<AdminMassPostProgressProps | null>(null);
  const usImportProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [urlImportOpen, setUrlImportOpen] = useState(false);
  const [urlImportBusy, setUrlImportBusy] = useState(false);
  const [urlImportPreview, setUrlImportPreview] = useState<ImportUrlPreview | null>(null);
  const [urlImportError, setUrlImportError] = useState<string | null>(null);
  const [urlImportSuccess, setUrlImportSuccess] = useState<string | null>(null);

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
  const [massPostProgress, setMassPostProgress] = useState<AdminMassPostProgressProps | null>(null);
  const [massSkipping, setMassSkipping] = useState(false);
  const [massError, setMassError] = useState<string | null>(null);
  const [massResultSummary, setMassResultSummary] = useState<string | null>(null);
  const [massFailures, setMassFailures] = useState<string[]>([]);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const activeQueueItemRef = useRef<HTMLButtonElement>(null);
  const [listScrollTick, setListScrollTick] = useState(0);

  const scrollActiveRowIntoView = useCallback(() => {
    setListScrollTick((n) => n + 1);
  }, []);

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
    setPubAdminNotes(row.source_notes?.trim() ?? "");
  };

  const fetchRows = useCallback(async (
    tab: QueueTab,
    postedFilter: PostedView,
    options?: { silent?: boolean }
  ): Promise<InventoryImportQueueRow[]> => {
    if (!options?.silent) {
      setLoading(true);
    }
    setLoadError(null);
    const statusFilter: InventoryImportQueueStatus = tab;
    let q = supabase
      .from("inventory_import_queue")
      .select("*")
      .eq("status", statusFilter)
      .order("created_at", { ascending: false });
    if (tab === "posted") {
      q = postedFilter === "removed" ? q.is("imported_inventory_id", null) : q.not("imported_inventory_id", "is", null);
    }
    const { data, error } = await q;
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
    if (!options?.silent) {
      setLoading(false);
    }
    return parsed;
  }, []);

  const reloadCurrentTab = useCallback(
    async (options?: { silent?: boolean }) => {
      const listScrollTop = options?.silent ? listScrollRef.current?.scrollTop : undefined;
      const parsed = await fetchRows(queueTab, postedView, options);
      if (options?.silent && listScrollRef.current != null && listScrollTop != null) {
        listScrollRef.current.scrollTop = listScrollTop;
      }
      return parsed;
    },
    [queueTab, postedView, fetchRows]
  );

  useEffect(() => {
    void Promise.resolve().then(() => reloadCurrentTab());
  }, [reloadCurrentTab]);

  useEffect(() => {
    if (listScrollTick === 0) return;
    requestAnimationFrame(() => {
      activeQueueItemRef.current?.scrollIntoView({ block: "nearest" });
    });
  }, [listScrollTick]);

  const clearUsImportProgressTimer = useCallback(() => {
    if (usImportProgressTimerRef.current) {
      clearInterval(usImportProgressTimerRef.current);
      usImportProgressTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearUsImportProgressTimer(), [clearUsImportProgressTimer]);

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
  const postedInCatalogTotal = queueCounts?.postedInCatalog ?? null;
  const postedLogTotal = queueCounts?.posted ?? null;
  const postedRemovedTotal = queueCounts?.postedRemoved ?? 0;
  const skippedDbTotal = queueCounts?.skipped ?? null;
  const pendingListCapped = queueTab === "pending" && pendingDbTotal != null && !loading && rows.length < pendingDbTotal;
  const allPendingSelected =
    pendingRows.length > 0 && pendingRows.every((r) => checkedIds.has(r.id));

  const selectAllPending = () => setCheckedIds(new Set(pendingRows.map((r) => r.id)));

  const setQueueTabAndReset = (tab: QueueTab) => {
    setQueueTab(tab);
    if (tab === "posted") setPostedView("in-catalog");
    setSelectedId(null);
    setActionError(null);
    setSaveError(null);
    setPublishError(null);
    clearChecked();
    setMassError(null);
    setMassResultSummary(null);
    setMassFailures([]);
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
    const stock = normalizeStockNumber(editStock);
    try {
      const conflict = await findStockConflict(supabase, stock, { excludeQueueId: selected.id });
      if (conflict) {
        setSaveError(stockConflictMessage(conflict, stock));
        if (conflict.kind === "catalog") {
          const dup = await findInventoryUnitByStock(supabase, stock);
          if (dup) setStockDuplicate(dup);
        }
        return;
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not verify stock number.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("inventory_import_queue")
      .update({
        stock_number: stock,
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
      const sid = selected.id;
      const next = await reloadCurrentTab({ silent: true });
      applyRowToForm(next.find((x) => x.id === sid) ?? null);
      scrollActiveRowIntoView();
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
    const sid = selected.id;
    const next = await reloadCurrentTab({ silent: true });
    applyRowToForm(next.find((x) => x.id === sid) ?? null);
    scrollActiveRowIntoView();
    setRemovingPhotoUrl(null);
  };

  const reorderSourcePhotos = async (orderedUrls: string[]) => {
    if (!selected || selected.status !== "pending") return;
    if (orderedUrls.join("\0") === selected.source_photo_urls.join("\0")) return;

    setReorderingPhotos(true);
    setPhotoRemoveError(null);
    const { error } = await supabase
      .from("inventory_import_queue")
      .update({ source_photo_urls: orderedUrls })
      .eq("id", selected.id)
      .eq("status", "pending");
    setReorderingPhotos(false);
    if (error) {
      setPhotoRemoveError(error.message);
      return;
    }
    const sid = selected.id;
    const next = await reloadCurrentTab({ silent: true });
    applyRowToForm(next.find((x) => x.id === sid) ?? null);
    scrollActiveRowIntoView();
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
      const next = await fetchRows("pending", "in-catalog");
      setSelectedId(selected.id);
      applyRowToForm(next.find((x) => x.id === selected.id) ?? null);
    }
    setActionBusy(false);
  };

  const deleteSkippedPermanent = async () => {
    if (!selected || selected.status !== "skipped") return;
    if (
      !window.confirm(
        `Permanently delete this skipped import row (${rowTitle(selected)})? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setActionError(null);
    const { error } = await supabase
      .from("inventory_import_queue")
      .delete()
      .eq("id", selected.id)
      .eq("status", "skipped");
    if (error) {
      setActionError(error.message);
    } else {
      setSelectedId(null);
      applyRowToForm(null);
      await reloadCurrentTab();
      onInventoryChanged?.();
    }
    setDeleting(false);
  };

  const runOverlandImportSync = async () => {
    setImportSyncError(null);
    setImportSyncSummary(null);
    setImportSyncing(true);
    const result = await syncOverlandramImportQueue(supabase);
    if (!result.ok) {
      setImportSyncError(result.error);
    } else {
      setImportSyncSummary(formatOverlandramImportSyncSummary(result.stats));
      const queueChanged =
        result.stats.importedNew > 0 ||
        result.stats.removedStale > 0 ||
        result.stats.removedPendingOffFeed > 0;
      if (queueChanged) {
        setQueueTab("pending");
        setSelectedId(null);
        applyRowToForm(null);
        await fetchRows("pending", "in-catalog");
        onInventoryChanged?.();
      }
    }
    setImportSyncing(false);
  };

  const runUsImport = async (payload: {
    total: number;
    categoryCounts: UsImportCategoryCounts;
    usedOnly: boolean;
  }) => {
    setUsImportError(null);
    setUsImportSummary(null);
    setUsImporting(true);
    setUsImportOpen(false);

    const startedAt = Date.now();
    const tick = () => {
      const estimate = estimateUsImportSearchProgress(Date.now() - startedAt, payload.total);
      setUsImportProgress({
        completed: estimate.completed,
        total: estimate.total,
        succeeded: 0,
        failed: 0,
        title: estimate.title,
        detailLine: estimate.detailLine,
        verb: "Searching"
      });
    };

    tick();
    clearUsImportProgressTimer();
    usImportProgressTimerRef.current = setInterval(tick, 400);

    const result = await importUsDealerInventory(supabase, payload);
    clearUsImportProgressTimer();

    if (!result.ok) {
      setUsImportProgress(null);
      setUsImportError(result.error);
    } else {
      const complete = usImportSearchCompleteProgress(payload.total, result.stats.queued);
      setUsImportProgress({
        completed: complete.completed,
        total: complete.total,
        succeeded: complete.succeeded,
        failed: complete.failed,
        title: complete.title,
        detailLine: undefined,
        okStatLabel: "queued",
        failStatLabel: "not found",
        verb: "Searching"
      });
      await new Promise((resolve) => setTimeout(resolve, 700));
      setUsImportProgress(null);
      setUsImportSummary(formatUsImportSummary(result.stats, payload.total));
      if (result.stats.queued > 0) {
        setQueueTab("pending");
        setSelectedId(null);
        applyRowToForm(null);
        await fetchRows("pending", "in-catalog");
        onInventoryChanged?.();
      }
    }
    setUsImporting(false);
  };

  const closeUrlImportModal = () => {
    if (urlImportBusy) return;
    setUrlImportOpen(false);
    setUrlImportPreview(null);
    setUrlImportError(null);
  };

  const runUrlCheck = async (url: string) => {
    setUrlImportError(null);
    setUrlImportBusy(true);
    const result = await importUrlToQueue(supabase, url, { dryRun: true });
    if (!result.ok) {
      setUrlImportError(result.error);
      setUrlImportPreview(null);
    } else {
      setUrlImportPreview(result.preview);
    }
    setUrlImportBusy(false);
  };

  const runUrlImport = async (url: string) => {
    setUrlImportError(null);
    setUrlImportSuccess(null);
    setUrlImportBusy(true);
    let preview = urlImportPreview;
    if (!preview) {
      const check = await importUrlToQueue(supabase, url, { dryRun: true });
      if (!check.ok) {
        setUrlImportError(check.error);
        setUrlImportBusy(false);
        return;
      }
      preview = check.preview;
      setUrlImportPreview(preview);
    }

    const result = await importUrlToQueue(supabase, url);
    if (!result.ok) {
      setUrlImportError(result.error);
    } else {
      const title = `${preview.year} ${preview.make} ${preview.model}`.trim();
      setUrlImportSuccess(
        result.stock
          ? `Added ${title} to pending queue as stock #${result.stock}.`
          : `Added ${title} to pending queue.`
      );
      setUrlImportOpen(false);
      setUrlImportPreview(null);
      setQueueTab("pending");
      setSelectedId(null);
      applyRowToForm(null);
      await fetchRows("pending", "in-catalog");
      onInventoryChanged?.();
    }
    setUrlImportBusy(false);
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

    try {
      const conflict = await findStockConflict(supabase, stock, { excludeQueueId: selected.id });
      if (conflict) {
        setPublishError(stockConflictMessage(conflict, stock));
        if (conflict.kind === "catalog") {
          const dup = await findInventoryUnitByStock(supabase, stock);
          if (dup) setStockDuplicate(dup);
        }
        return;
      }
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Could not verify stock number.");
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

  const executeMassPost = (targets: InventoryImportQueueRow[]) => {
    if (targets.length === 0) return;

    const cost = Number.parseFloat(pubCost);
    if (!Number.isFinite(cost) || cost < 0) {
      setMassError("Enter a valid cost in the mass post settings.");
      return;
    }

    const countLabel = `${targets.length} selected import${targets.length === 1 ? "" : "s"}`;

    const ok = window.confirm(
      `Post ${countLabel} to the catalog?\n\n` +
        `Each row uses its queue stock # and vehicle fields. Shared cost ($${cost}) and status (${pubStatus}) apply. ` +
        `Photos are downloaded from source URLs.\n\n` +
        `This cannot be undone in one step. Rows that fail (duplicate stock, missing photos) are listed in the summary.\n\n` +
        `Continue?`
    );
    if (!ok) return;

    void (async () => {
      setMassSubmitting(true);
      setMassError(null);
      setMassResultSummary(null);
      setMassFailures([]);
      setMassPostProgress({ completed: 0, total: targets.length, succeeded: 0, failed: 0, label: null });
      let okCount = 0;
      const failures: string[] = [];
      for (let i = 0; i < targets.length; i += 1) {
        const row = targets[i]!;
        setMassPostProgress({
          completed: i,
          total: targets.length,
          succeeded: okCount,
          failed: failures.length,
          label: row.stock_number
        });
        const result = await publishImportQueueRow(supabase, row, {
          cost,
          status: pubStatus,
          adminNotes: pubAdminNotes.trim() || null
        });
        if (result.ok) okCount += 1;
        else failures.push(`${result.stock}: ${result.error}`);
        setMassPostProgress({
          completed: i + 1,
          total: targets.length,
          succeeded: okCount,
          failed: failures.length,
          label: row.stock_number
        });
      }
      clearChecked();
      setSelectedId(null);
      applyRowToForm(null);
      await reloadCurrentTab();
      onInventoryChanged?.();
      const parts = [`Posted ${okCount} of ${targets.length}.`];
      if (failures.length > 0) {
        parts.push(`${failures.length} failed — see list below.`);
      }
      setMassResultSummary(parts.join(" "));
      setMassFailures(failures);
      setMassPostProgress(null);
      setMassSubmitting(false);
    })();
  };

  const runMassSubmit = () => {
    executeMassPost(rows.filter((r) => checkedIds.has(r.id) && r.status === "pending"));
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
          Import queue
        </h2>
        <div className="admin-importQueueHeadingActions">
          <button
            type="button"
            className="btn btn-secondary admin-importSyncBtn"
            disabled={importSyncing || usImporting || urlImportBusy || publishing || actionBusy || massSubmitting || massSkipping}
            onClick={() => void runOverlandImportSync()}
          >
            {importSyncing ? "Importing…" : "Import Overland RAM"}
          </button>
          <button
            type="button"
            className="btn btn-secondary admin-importSyncBtn"
            disabled={importSyncing || usImporting || urlImportBusy || publishing || actionBusy || massSubmitting || massSkipping}
            onClick={() => {
              setUrlImportError(null);
              setUrlImportSuccess(null);
              setUrlImportPreview(null);
              setUrlImportOpen(true);
            }}
          >
            {urlImportBusy ? "Importing…" : "Import from link"}
          </button>
          <button
            type="button"
            className="btn btn-primary admin-importSyncBtn"
            disabled={importSyncing || usImporting || urlImportBusy || publishing || actionBusy || massSubmitting || massSkipping}
            onClick={() => setUsImportOpen(true)}
          >
            {usImporting ? "Importing…" : "Import US units"}
          </button>
        </div>
      </div>
      <p className="admin-invPanelIntro">
        Import US dealer listings selectively (1–30 units with a category mix), paste a single listing link, or sync
        all new units from Overland RAM. Review each row, then post to the catalog.
      </p>
      {urlImportSuccess ? (
        <div className="admin-importSyncSummary" role="status" aria-live="polite">
          <p className="admin-importSyncSuccessLead">{urlImportSuccess}</p>
        </div>
      ) : null}
      {urlImportError && !urlImportOpen ? (
        <div className="sell-ride-applyErrorBanner" role="alert">
          <p className="sell-ride-applyError">{urlImportError}</p>
        </div>
      ) : null}
      {usImportSummary ? (
        <div className="admin-importSyncSummary" role="status" aria-live="polite">
          <p className="admin-importSyncSuccessLead">{usImportSummary.headline}</p>
          {usImportSummary.detailLines.length > 0 ? (
            <ul className="admin-importSyncSummaryList">
              {usImportSummary.detailLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {usImportSummary.warningLines.map((line) => (
            <p key={line} className="admin-importSyncSummaryExtra">
              {line}
            </p>
          ))}
        </div>
      ) : null}
      {usImportError ? (
        <div className="sell-ride-applyErrorBanner" role="alert">
          <p className="sell-ride-applyError">{usImportError}</p>
        </div>
      ) : null}
      {importSyncSummary ? (
        <div className="admin-importSyncSummary" role="status" aria-live="polite">
          <p className="admin-importSyncSuccessLead">{importSyncSummary.headline}</p>
          {importSyncSummary.ignoredLines.length > 0 ? (
            <ul className="admin-importSyncSummaryList">
              {importSyncSummary.ignoredLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {importSyncSummary.extraLines.map((line) => (
            <p key={line} className="admin-importSyncSummaryExtra">
              {line}
            </p>
          ))}
        </div>
      ) : null}
      {importSyncError ? (
        <div className="sell-ride-applyErrorBanner" role="alert">
          <p className="sell-ride-applyError">{importSyncError}</p>
        </div>
      ) : null}

      <AdminUsImportModal
        open={usImportOpen}
        busy={usImporting}
        onClose={() => !usImporting && setUsImportOpen(false)}
        onSubmit={(payload) => void runUsImport(payload)}
      />

      <AdminImportUrlModal
        open={urlImportOpen}
        busy={urlImportBusy}
        preview={urlImportPreview}
        error={urlImportError}
        onClose={closeUrlImportModal}
        onCheck={(url) => void runUrlCheck(url)}
        onImport={(url) => void runUrlImport(url)}
      />

      {usImportProgress ? <AdminMassPostProgress {...usImportProgress} /> : null}

      {massSubmitting && massPostProgress ? (
        <AdminMassPostProgress
          completed={massPostProgress.completed}
          total={massPostProgress.total}
          succeeded={massPostProgress.succeeded}
          failed={massPostProgress.failed}
          label={massPostProgress.label}
        />
      ) : null}

      {massFailures.length > 0 ? (
        <div className="admin-massPostFailures" role="alert">
          <p className="admin-massPostFailuresTitle">Failed to post ({massFailures.length})</p>
          <ul className="admin-massPostFailuresList">
            {massFailures.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
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
          {postedInCatalogTotal != null ? (
            <span
              className="admin-sell-queueQueueTabCount"
              title={
                postedLogTotal != null && postedLogTotal !== postedInCatalogTotal
                  ? `${postedInCatalogTotal} still in catalog · ${postedLogTotal} total posted from import`
                  : undefined
              }
            >
              {formatAdminCount(postedInCatalogTotal)}
            </span>
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
            Set cost and status before you select rows and mass post to catalog.
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
          massPostProgress={massPostProgress}
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
              Showing {formatAdminCount(rows.length)} of {formatAdminCount(pendingDbTotal)} pending in the list. Use
              counts above the tabs for full database totals.
            </p>
          ) : null}
          {queueTab === "posted" ? (
            <div className="admin-importPostedFilters" role="group" aria-label="Posted import filter">
              <button
                type="button"
                className={`admin-importPostedFilter${postedView === "in-catalog" ? " admin-importPostedFilterActive" : ""}`}
                aria-pressed={postedView === "in-catalog"}
                onClick={() => {
                  setPostedView("in-catalog");
                  setSelectedId(null);
                }}
              >
                In catalog ({formatAdminCount(postedInCatalogTotal ?? rows.length)})
              </button>
              {postedRemovedTotal > 0 ? (
                <button
                  type="button"
                  className={`admin-importPostedFilter${postedView === "removed" ? " admin-importPostedFilterActive" : ""}`}
                  aria-pressed={postedView === "removed"}
                  onClick={() => {
                    setPostedView("removed");
                    setSelectedId(null);
                  }}
                >
                  Removed from catalog ({formatAdminCount(postedRemovedTotal)})
                </button>
              ) : null}
            </div>
          ) : null}
          {queueTab === "posted" && postedView === "in-catalog" && postedLogTotal != null && postedRemovedTotal > 0 ? (
            <p className="sell-ride-applyHint admin-invListCapHint" role="status">
              {formatAdminCount(postedInCatalogTotal ?? rows.length)} import posts still in the catalog — matches
              Catalog → From import. {formatAdminCount(postedLogTotal)} total in the import log (
              {formatAdminCount(postedRemovedTotal)} removed).
            </p>
          ) : null}
          {loading ? (
            <p className="sell-ride-applyMuted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="sell-ride-applyMuted">No rows in this queue.</p>
          ) : (
            <div className="admin-invUnitListScroll" ref={listScrollRef}>
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
                      ref={active ? activeQueueItemRef : undefined}
                      type="button"
                      className={`admin-sell-queueItem${active ? " admin-sell-queueItemActive" : ""}`}
                      onClick={() => selectRow(r.id)}
                    >
                      <span className="admin-sell-queueItemTitle">{title}</span>
                      <span className="admin-sell-queueItemMeta">
                        {r.stock_number} · Source #{r.source_product_id}
                        {queueTab === "posted" && r.imported_inventory_id
                          ? ` · unit ${r.imported_inventory_id.slice(0, 8)}…`
                          : queueTab === "posted"
                            ? " · removed from catalog"
                            : ""}
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
                        View source listing
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
              <div className="sell-ride-applyActions admin-sell-queueRejectedActions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={actionBusy || deleting}
                  onClick={() => void restoreSkipped()}
                >
                  {actionBusy ? "Restoring…" : "Move back to pending"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={actionBusy || deleting}
                  onClick={() => selectRow(null)}
                >
                  Clear selection
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={actionBusy || deleting}
                  onClick={() => void deleteSkippedPermanent()}
                >
                  {deleting ? "Deleting…" : "Delete permanently"}
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
                <AdminSortablePhotoList
                  variant="tile"
                  items={selected.source_photo_urls.map((u) => ({ id: u, src: u }))}
                  busy={reorderingPhotos}
                  removingId={removingPhotoUrl}
                  onReorder={(orderedUrls) => void reorderSourcePhotos(orderedUrls)}
                  onRemove={(url) => void removeSourcePhoto(url)}
                />
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
