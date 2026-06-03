import type { SupabaseClient } from "@supabase/supabase-js";
import { INVENTORY_PHOTOS_BUCKET } from "../data/inventory";

function sanitizeFileStem(name: string): string {
  const trimmed = name.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return trimmed.slice(0, 80) || "listing";
}

function photoExtension(path: string): string {
  const base = path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path;
  const dot = base.lastIndexOf(".");
  if (dot < 0) return ".jpg";
  const ext = base.slice(dot).toLowerCase();
  if (/^\.(jpe?g|png|webp|gif)$/.test(ext)) return ext;
  return ".jpg";
}

export function listingPhotoDownloadName(stockNumber: string, index: number, storagePath: string): string {
  const stem = sanitizeFileStem(stockNumber);
  const ordinal = String(index + 1).padStart(2, "0");
  const cover = index === 0 ? "-cover" : "";
  return `${stem}-${ordinal}${cover}${photoExtension(storagePath)}`;
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
};

async function saveBlobToDirectory(
  directory: FileSystemDirectoryHandle,
  fileName: string,
  blob: Blob
): Promise<void> {
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

function triggerBrowserDownload(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export type DownloadListingPhotosResult =
  | { ok: true; saved: number; method: "directory" | "browser" }
  | { ok: false; error: string; cancelled?: boolean };

export async function downloadListingPhotos(
  supabase: SupabaseClient,
  photoPaths: string[],
  stockNumber: string
): Promise<DownloadListingPhotosResult> {
  if (photoPaths.length < 1) {
    return { ok: false, error: "No photos to download." };
  }

  let directory: FileSystemDirectoryHandle | null = null;
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (picker) {
    try {
      directory = await picker({ mode: "readwrite" });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return { ok: false, error: "Download cancelled.", cancelled: true };
      }
      return { ok: false, error: e instanceof Error ? e.message : "Could not open folder picker." };
    }
  }

  let saved = 0;
  for (let index = 0; index < photoPaths.length; index++) {
    const path = photoPaths[index]!;
    const { data, error } = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).download(path);
    if (error || !data) {
      return { ok: false, error: error?.message ?? `Failed to download photo ${index + 1}.` };
    }

    const fileName = listingPhotoDownloadName(stockNumber, index, path);
    if (directory) {
      try {
        await saveBlobToDirectory(directory, fileName, data);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : `Could not save ${fileName}.` };
      }
    } else {
      triggerBrowserDownload(fileName, data);
    }
    saved += 1;
  }

  return {
    ok: true,
    saved,
    method: directory ? "directory" : "browser"
  };
}
