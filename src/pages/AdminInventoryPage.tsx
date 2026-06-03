import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminCustomerUnitsPanel } from "../components/AdminCustomerUnitsPanel";
import { AdminInventoryCountSummary } from "../components/AdminInventoryCountSummary";
import { AdminImportQueuePanel } from "../components/AdminImportQueuePanel";
import { AdminSellQueuePanel } from "../components/AdminSellQueuePanel";
import { fetchAdminInventoryCounts, formatAdminCount, type AdminInventoryCounts } from "../lib/adminInventoryCounts";
import { reconcileOrphanedImportCatalogLinks } from "../lib/reconcileImportCatalogLinks";
import { AdminStockDuplicateError } from "../components/AdminStockDuplicateError";
import { AdminSortablePhotoList } from "../components/AdminSortablePhotoList";
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
import { downloadListingPhotos } from "../lib/downloadListingPhotos";
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

function unitMatchesCatalogSearch(row: InventoryUnitRow, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = [
    row.stock_number,
    row.make,
    row.model,
    inventoryDisplayTitle(row),
    String(row.year),
    row.status,
    row.category,
    row.vin ?? "",
    row.admin_notes ?? "",
    row.odometer_km != null ? String(row.odometer_km) : "",
    row.is_customer_unit ? "customer" : ""
  ]
    .join(" ")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

type CatalogCategoryFilter = VehicleCategory | "all";

type CatalogSort = "updated" | "category" | "stock" | "year";

const CATEGORY_SORT_ORDER = new Map(VEHICLE_CATEGORIES.map((category, index) => [category, index]));

function sortCatalogUnits(rows: InventoryUnitRow[], sort: CatalogSort): InventoryUnitRow[] {
  const copy = [...rows];
  switch (sort) {
    case "category":
      return copy.sort((a, b) => {
        const byCategory = (CATEGORY_SORT_ORDER.get(a.category) ?? 99) - (CATEGORY_SORT_ORDER.get(b.category) ?? 99);
        if (byCategory !== 0) return byCategory;
        return inventoryDisplayTitle(a).localeCompare(inventoryDisplayTitle(b), undefined, { sensitivity: "base" });
      });
    case "stock":
      return copy.sort((a, b) => a.stock_number.localeCompare(b.stock_number, undefined, { numeric: true }));
    case "year":
      return copy.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return inventoryDisplayTitle(a).localeCompare(inventoryDisplayTitle(b), undefined, { sensitivity: "base" });
      });
    case "updated":
    default:
      return copy;
  }
}

type FormFields = {
  stock_number: string;
  year: string;
  make: string;
  model: string;
  odometer_km: string;
  category: VehicleCategory;
  cost: string;
  marketplace_list_price: string;
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
  marketplace_list_price: "",
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
  const [reorderingPhotos, setReorderingPhotos] = useState(false);
  const [downloadingPhotos, setDownloadingPhotos] = useState(false);
  const [photoDownloadMessage, setPhotoDownloadMessage] = useState<string | null>(null);
  const [stockDuplicate, setStockDuplicate] = useState<StockDuplicateMatch | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<CatalogCategoryFilter>("all");
  const [catalogSort, setCatalogSort] = useState<CatalogSort>("updated");

  const filteredUnits = useMemo(() => {
    let list = units.filter((row) => unitMatchesCatalogSearch(row, catalogSearch));
    if (catalogCategoryFilter !== "all") {
      list = list.filter((row) => row.category === catalogCategoryFilter);
    }
    if (catalogSort !== "updated") {
      list = sortCatalogUnits(list, catalogSort);
    }
    return list;
  }, [units, catalogSearch, catalogCategoryFilter, catalogSort]);

  const catalogSearchActive = catalogSearch.trim().length > 0;
  const catalogFiltersActive = catalogSearchActive || catalogCategoryFilter !== "all" || catalogSort !== "updated";

  const [counts, setCounts] = useState<AdminInventoryCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);
  const [countsError, setCountsError] = useState<string | null>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const activeUnitItemRef = useRef<HTMLButtonElement>(null);
  const [listScrollTick, setListScrollTick] = useState(0);

  const scrollActiveUnitIntoView = useCallback(() => {
    setListScrollTick((n) => n + 1);
  }, []);

  const loadUnits = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setListLoading(true);
    }
    setLoadError(null);
    const { data, error } = await supabase.from("inventory_units").select("*").order("updated_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
      setUnits([]);
    } else {
      setUnits((data ?? []).map((r) => parseInventoryUnitRow(r)).filter((r): r is InventoryUnitRow => r != null));
    }
    if (!options?.silent) {
      setListLoading(false);
    }
  }, []);

  const loadCounts = useCallback(async () => {
    setCountsLoading(true);
    setCountsError(null);
    try {
      setCounts(await fetchAdminInventoryCounts(supabase));
    } catch (e) {
      setCounts(null);
      setCountsError(e instanceof Error ? e.message : "Failed to load counts.");
    }
    setCountsLoading(false);
  }, []);

  const refreshInventory = useCallback(async (options?: { silent?: boolean }) => {
    try {
      await reconcileOrphanedImportCatalogLinks(supabase);
    } catch {
      /* counts still load if reconcile fails */
    }
    const listScrollTop = options?.silent ? listScrollRef.current?.scrollTop : undefined;
    await Promise.all([loadUnits(options), loadCounts()]);
    if (options?.silent && listScrollRef.current != null && listScrollTop != null) {
      listScrollRef.current.scrollTop = listScrollTop;
    }
  }, [loadUnits, loadCounts]);

  useEffect(() => {
    void Promise.resolve().then(() => refreshInventory());
  }, [refreshInventory]);

  useEffect(() => {
    if (listScrollTick === 0) return;
    requestAnimationFrame(() => {
      activeUnitItemRef.current?.scrollIntoView({ block: "nearest" });
    });
  }, [listScrollTick]);

  const catalogTotal = counts?.catalog.total ?? null;
  const catalogFromImport = counts?.catalog.fromImport ?? null;
  const catalogListCapped = catalogTotal != null && !listLoading && units.length < catalogTotal;

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
      marketplace_list_price:
        row.marketplace_list_price != null ? String(row.marketplace_list_price) : "",
      status: row.status,
      is_customer_unit: row.is_customer_unit,
      vin: row.vin ?? "",
      admin_notes: row.admin_notes ?? ""
    });
    setPendingFiles(null);
    setFormError(null);
    setStockDuplicate(null);
    setPhotoDownloadMessage(null);
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
    setPhotoDownloadMessage(null);
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
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const advanceToNext =
      submitter instanceof HTMLButtonElement && submitter.dataset.action === "save-next";
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
    const marketplace_list_price: number | null = (() => {
      if (form.marketplace_list_price.trim() === "") return null;
      const p = Number.parseFloat(form.marketplace_list_price);
      return Number.isFinite(p) && p >= 0 ? p : NaN;
    })();
    if (marketplace_list_price !== null && Number.isNaN(marketplace_list_price)) {
      setFormError("Enter a valid Facebook list price or leave blank.");
      return;
    }

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
    const savedEditingId = editingId;
    const nextUnitId =
      advanceToNext && savedEditingId
        ? (() => {
            const idx = filteredUnits.findIndex((u) => u.id === savedEditingId);
            if (idx < 0) return null;
            return filteredUnits[idx + 1]?.id ?? filteredUnits[0]?.id ?? null;
          })()
        : null;
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
            marketplace_list_price,
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
            marketplace_list_price,
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
      setPendingFiles(null);
      await refreshInventory({ silent: true });
      if (savedEditingId) {
        const targetId =
          advanceToNext && nextUnitId && nextUnitId !== savedEditingId ? nextUnitId : savedEditingId;
        const { data } = await supabase.from("inventory_units").select("*").eq("id", targetId).maybeSingle();
        const parsed = data ? parseInventoryUnitRow(data) : null;
        if (parsed) startEdit(parsed);
        scrollActiveUnitIntoView();
      } else {
        resetForm();
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed.");
    }
    setIsSaving(false);
  };

  const unlistUnit = async () => {
    if (!editingId) return;
    const row = units.find((u) => u.id === editingId);
    if (!row) return;
    if (row.status === "Unlisted") {
      resetForm();
      return;
    }
    if (
      !window.confirm(
        `Unlist stock #${row.stock_number} (${inventoryDisplayTitle(row)})? It will be hidden from the public site but stays in the catalog here.`
      )
    ) {
      return;
    }
    setIsSaving(true);
    setFormError(null);
    const { error } = await supabase.from("inventory_units").update({ status: "Unlisted" }).eq("id", editingId);
    if (error) {
      setFormError(error.message);
      setIsSaving(false);
      return;
    }
    await refreshInventory();
    resetForm();
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
    void refreshInventory();
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
    void refreshInventory();
    if (editingId === row.id) {
      setForm((f) => ({ ...f }));
    }
  };

  const reorderPhotos = async (row: InventoryUnitRow, orderedPaths: string[]) => {
    if (orderedPaths.join("\0") === row.photo_paths.join("\0")) return;
    setReorderingPhotos(true);
    const { error } = await supabase.from("inventory_units").update({ photo_paths: orderedPaths }).eq("id", row.id);
    setReorderingPhotos(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    void refreshInventory();
  };

  const downloadAllPhotos = async (row: InventoryUnitRow) => {
    setPhotoDownloadMessage(null);
    setDownloadingPhotos(true);
    try {
      const result = await downloadListingPhotos(supabase, row.photo_paths, row.stock_number);
      if (!result.ok) {
        if (!result.cancelled) {
          setPhotoDownloadMessage(result.error);
        }
        return;
      }
      setPhotoDownloadMessage(
        result.method === "directory"
          ? `Saved ${result.saved} photo${result.saved === 1 ? "" : "s"} to the folder you chose. Filenames use stock #${row.stock_number} and photo order (01-cover is the listing cover).`
          : `Downloaded ${result.saved} photo${result.saved === 1 ? "" : "s"} to your browser downloads folder. Use Chrome or Edge to choose a save folder instead.`
      );
    } finally {
      setDownloadingPhotos(false);
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
          Manage the public catalog, sell-your-ride submissions, and staged imports in one place. Cost stays admin-only. Use{" "}
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
          <span
            className="admin-invTabCount"
            title={
              catalogFromImport != null && catalogTotal != null && catalogFromImport !== catalogTotal
                ? `${catalogFromImport} from import · ${catalogTotal} total catalog units`
                : undefined
            }
          >
            {countsLoading ? "…" : formatAdminCount(counts?.catalog.total)}
          </span>
        </button>
        <span className="admin-invTabDivider" aria-hidden />
        <button
          type="button"
          className={adminTab === "sell" ? "admin-invTab admin-invTabActive" : "admin-invTab"}
          aria-current={adminTab === "sell" ? "page" : undefined}
          onClick={() => setAdminTab("sell")}
        >
          Sell submissions
          <span className="admin-invTabCount">{countsLoading ? "…" : formatAdminCount(counts?.sell.total)}</span>
        </button>
        <span className="admin-invTabDivider" aria-hidden />
        <button
          type="button"
          className={adminTab === "import" ? "admin-invTab admin-invTabActive" : "admin-invTab"}
          aria-current={adminTab === "import" ? "page" : undefined}
          onClick={() => setAdminTab("import")}
        >
          Import
          <span className="admin-invTabCount">{countsLoading ? "…" : formatAdminCount(counts?.import.total)}</span>
        </button>
        <span className="admin-invTabDivider" aria-hidden />
        <button
          type="button"
          className={adminTab === "customer" ? "admin-invTab admin-invTabActive" : "admin-invTab"}
          aria-current={adminTab === "customer" ? "page" : undefined}
          onClick={() => setAdminTab("customer")}
        >
          Customer units
          <span className="admin-invTabCount">{countsLoading ? "…" : formatAdminCount(counts?.customer)}</span>
        </button>
      </nav>

      <AdminInventoryCountSummary counts={counts} loading={countsLoading} error={countsError} />

      {adminTab === "sell" ? (
        <AdminSellQueuePanel
          queueCounts={counts?.sell}
          onInventoryChanged={() => void refreshInventory()}
        />
      ) : adminTab === "import" ? (
        <AdminImportQueuePanel
          queueCounts={counts?.import}
          onInventoryChanged={() => void refreshInventory()}
        />
      ) : adminTab === "customer" ? (
        <AdminCustomerUnitsPanel onInventoryChanged={() => void refreshInventory()} />
      ) : (
        <div className="admin-invCatalogLayout">
          <section
            className="sell-ride-applyForm admin-invListPanel"
            aria-labelledby="admin-inv-list-heading"
          >
            <div className="admin-invListPanelHead">
              <h2 id="admin-inv-list-heading" className="sell-ride-applyPhotosTitle">
                Units
                {!countsLoading && catalogTotal != null ? (
                  <span className="admin-invListCount">
                    {catalogFiltersActive
                      ? `${formatAdminCount(filteredUnits.length)} shown`
                      : catalogFromImport != null && catalogFromImport !== catalogTotal
                        ? `${formatAdminCount(catalogTotal)} (${formatAdminCount(catalogFromImport)} from import)`
                        : formatAdminCount(catalogTotal)}
                  </span>
                ) : null}
              </h2>
              <button
                type="button"
                className={`btn btn-secondary admin-invMiniBtn admin-invAddUnitBtn${!editingId ? " admin-invAddUnitBtnActive" : ""}`}
                onClick={resetForm}
              >
                Add new
              </button>
            </div>
            {catalogListCapped ? (
              <p className="sell-ride-applyHint admin-invListCapHint" role="status">
                Showing the first {formatAdminCount(units.length)} units in this list. Total in catalog:{" "}
                {formatAdminCount(catalogTotal)}.
              </p>
            ) : null}
            <div className="admin-invCatalogFilters">
              <div className="admin-invCatalogFilterBar">
                <label className="admin-invCatalogFilterInline" htmlFor="admin-inv-catalog-type">
                  <span className="admin-invCatalogFilterInlineLabel">Type</span>
                  <select
                    id="admin-inv-catalog-type"
                    className="select admin-invCatalogFilterSelect"
                    value={catalogCategoryFilter}
                    onChange={(e) => setCatalogCategoryFilter(e.target.value as CatalogCategoryFilter)}
                  >
                    <option value="all">All</option>
                    {VEHICLE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-invCatalogFilterInline" htmlFor="admin-inv-catalog-sort">
                  <span className="admin-invCatalogFilterInlineLabel">Sort</span>
                  <select
                    id="admin-inv-catalog-sort"
                    className="select admin-invCatalogFilterSelect"
                    value={catalogSort}
                    onChange={(e) => setCatalogSort(e.target.value as CatalogSort)}
                  >
                    <option value="updated">Updated</option>
                    <option value="category">Type</option>
                    <option value="stock">Stock #</option>
                    <option value="year">Year</option>
                  </select>
                </label>
                {catalogFiltersActive ? (
                  <button
                    type="button"
                    className="admin-invCatalogFilterClear"
                    onClick={() => {
                      setCatalogSearch("");
                      setCatalogCategoryFilter("all");
                      setCatalogSort("updated");
                    }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="admin-invCatalogSearchWrap">
                <label className="admin-invCatalogSearchLabel" htmlFor="admin-inv-catalog-search">
                  Search
                </label>
                <input
                  id="admin-inv-catalog-search"
                  type="search"
                  className="loginInput admin-invCatalogSearch"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Stock #, make, model, status…"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
            {loadError ? (
              <div className="sell-ride-applyErrorBanner" role="alert">
                <p className="sell-ride-applyError">{loadError}</p>
              </div>
            ) : listLoading ? (
              <p className="sell-ride-applyMuted">Loading…</p>
            ) : units.length === 0 ? (
              <p className="sell-ride-applyMuted">No units yet.</p>
            ) : filteredUnits.length === 0 ? (
              <p className="sell-ride-applyMuted">No units match your filters.</p>
            ) : (
              <div className="admin-invUnitListScroll" ref={listScrollRef}>
                <ul className="admin-invUnitItems">
                  {filteredUnits.map((row) => {
                    const active = row.id === editingId;
                    return (
                      <li key={row.id}>
                        <button
                          ref={active ? activeUnitItemRef : undefined}
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
                              {row.category}
                              {` · ${row.year}`}
                              {row.odometer_km != null ? ` · ${row.odometer_km.toLocaleString()} km` : ""}
                              {` · ${formatMoney(row.cost)}`}
                            </span>
                            <span
                              className={`inventory-status inventory-status${inventoryStatusPillModifier(row.status)} admin-invUnitItemStatus`}
                            >
                              {row.status}
                            </span>
                            {row.posted_to_marketplace ? (
                              <span className="admin-invFbListed" title={row.marketplace_listed_at ?? undefined}>
                                Listed on FB
                                {row.marketplace_listed_at
                                  ? ` · ${new Date(row.marketplace_listed_at).toLocaleDateString("en-CA")}`
                                  : ""}
                              </span>
                            ) : null}
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
                  <label className="loginLabel" htmlFor="adm-fb-price">
                    Facebook list price (CAD)
                  </label>
                  <input
                    id="adm-fb-price"
                    className="loginInput"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.marketplace_list_price}
                    onChange={(e) => setForm((f) => ({ ...f, marketplace_list_price: e.target.value }))}
                    placeholder="Optional — uses cost if blank"
                  />
                  <p className="sell-ride-applyHint">
                    Used by the Marketplace Lister Chrome extension. Leave blank to use cost.
                  </p>
                </div>
                {editingId ? (() => {
                  const editing = units.find((u) => u.id === editingId);
                  if (!editing?.posted_to_marketplace) return null;
                  return (
                    <div className="form-row sell-ride-applyFullWidth admin-invFbStatusReadonly">
                      <p className="sell-ride-applyHint">
                        <strong>Facebook Marketplace:</strong> marked as listed
                        {editing.marketplace_listed_at
                          ? ` on ${new Date(editing.marketplace_listed_at).toLocaleString("en-CA")}`
                          : ""}
                        . Updated via the Chrome extension.
                      </p>
                    </div>
                  );
                })() : null}
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
                      <div className="admin-invPhotosHead">
                        <p className="loginLabel">Current photos</p>
                        {editRow.photo_paths.length > 0 ? (
                          <button
                            type="button"
                            className="btn btn-secondary admin-invDownloadPhotosBtn"
                            disabled={downloadingPhotos || reorderingPhotos || isSaving}
                            onClick={() => void downloadAllPhotos(editRow)}
                          >
                            {downloadingPhotos ? "Downloading…" : "Download all photos"}
                          </button>
                        ) : null}
                      </div>
                      <AdminSortablePhotoList
                        variant="chip"
                        items={editRow.photo_paths.map((p) => ({
                          id: p,
                          src: inventoryPhotoPublicUrl(supabase, p)
                        }))}
                        busy={reorderingPhotos || downloadingPhotos}
                        emptyMessage="None yet"
                        onReorder={(orderedPaths) => void reorderPhotos(editRow, orderedPaths)}
                        onRemove={(path) => void removePhoto(editRow, path)}
                      />
                      {photoDownloadMessage ? (
                        <p
                          className={
                            photoDownloadMessage.toLowerCase().includes("failed") ||
                            photoDownloadMessage.toLowerCase().includes("could not")
                              ? "sell-ride-applyError"
                              : "sell-ride-applyHint"
                          }
                          role="status"
                        >
                          {photoDownloadMessage}
                        </p>
                      ) : (
                        <p className="sell-ride-applyHint">
                          Download all photos to a folder for Facebook Marketplace. In Chrome or Edge you can choose
                          where to save; other browsers save to Downloads.
                        </p>
                      )}
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
                  <button
                    className="btn btn-secondary"
                    type="submit"
                    data-action="save-next"
                    disabled={isSaving || filteredUnits.length <= 1}
                  >
                    {isSaving ? "Saving…" : "Save & next"}
                  </button>
                ) : null}
                {editingId ? (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={isSaving}>
                      Cancel edit
                    </button>
                    {units.find((u) => u.id === editingId)?.status !== "Unlisted" ? (
                      <button type="button" className="btn btn-secondary" disabled={isSaving} onClick={() => void unlistUnit()}>
                        Unlist
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-danger"
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
