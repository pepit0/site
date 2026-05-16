import { isVehicleCategory, type VehicleCategory } from "../data/inventory";

const SESSION_KEY = "sellRideApplyDraft:v1";
const IDB_NAME = "SellYourRideApplyDraft";
const IDB_STORE = "draft";
const IDB_KEY = "files";
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type SellRideApplyPersistedForm = {
  sellerFirstName: string;
  sellerLastName: string;
  sellerPhone: string;
  sellerEmail: string;
  year: string;
  make: string;
  model: string;
  odometerKm: string;
  category: VehicleCategory;
  sellerNotes: string;
};

export type SellRideApplyPersisted = {
  version: 1;
  step: 1 | 2;
  form: SellRideApplyPersistedForm;
};

export type FileDraftItem = {
  clientId: string;
  file: File;
};

type SerializedFile = {
  clientId: string;
  name: string;
  type: string;
  data: ArrayBuffer;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object";
}

export function readSellRideApplySessionDraft(): SellRideApplyPersisted | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as unknown;
    if (!isRecord(j) || j.version !== 1) return null;
    if (j.step !== 1 && j.step !== 2) return null;
    if (!isRecord(j.form)) return null;
    const f = j.form;
    const form: SellRideApplyPersistedForm = {
      sellerFirstName: typeof f.sellerFirstName === "string" ? f.sellerFirstName : "",
      sellerLastName: typeof f.sellerLastName === "string" ? f.sellerLastName : "",
      sellerPhone: typeof f.sellerPhone === "string" ? f.sellerPhone : "",
      sellerEmail: typeof f.sellerEmail === "string" ? f.sellerEmail : "",
      year: typeof f.year === "string" ? f.year : "",
      make: typeof f.make === "string" ? f.make : "",
      model: typeof f.model === "string" ? f.model : "",
      odometerKm: typeof f.odometerKm === "string" ? f.odometerKm : "",
      category: typeof f.category === "string" && isVehicleCategory(f.category) ? f.category : "Motorcycle",
      sellerNotes: typeof f.sellerNotes === "string" ? f.sellerNotes : ""
    };
    return { version: 1, step: j.step as 1 | 2, form };
  } catch {
    return null;
  }
}

export function writeSellRideApplySessionDraft(persisted: SellRideApplyPersisted): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(persisted));
  } catch {
    // Quota or private mode
  }
}

export function clearSellRideApplySessionDraft(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export { MAX_FILE_BYTES };

function openIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onerror = () => resolve(null);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
    } catch {
      resolve(null);
    }
  });
}

export async function writeSellRideApplyFileDraft(items: FileDraftItem[]): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  if (items.length === 0) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
    });
    db.close();
    return;
  }
  const serialized: SerializedFile[] = await Promise.all(
    items.map(async ({ clientId, file }) => ({
      clientId,
      name: file.name,
      type: file.type || "application/octet-stream",
      data: await file.arrayBuffer()
    }))
  );
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(IDB_STORE).put(serialized, IDB_KEY);
  });
  db.close();
}

export async function readSellRideApplyFileDraft(): Promise<FileDraftItem[]> {
  const db = await openIdb();
  if (!db) return [];
  const serialized = await new Promise<SerializedFile[] | undefined>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    tx.onerror = () => reject(tx.error);
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve(req.result as SerializedFile[] | undefined);
  });
  db.close();
  if (!Array.isArray(serialized) || serialized.length === 0) return [];
  const out: FileDraftItem[] = [];
  for (const row of serialized) {
    if (!row || typeof row !== "object") continue;
    const r = row as SerializedFile;
    if (typeof r.clientId !== "string" || typeof r.name !== "string" || !r.data) continue;
    const type = typeof r.type === "string" && r.type ? r.type : "application/octet-stream";
    const blob = new Blob([r.data], { type });
    const file = new File([blob], r.name, { type });
    out.push({ clientId: r.clientId, file });
  }
  return out;
}

export async function clearSellRideApplyFileDraft(): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(IDB_STORE).delete(IDB_KEY);
  });
  db.close();
}
