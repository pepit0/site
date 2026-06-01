import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";

export type ImportUrlPreview = {
  adapter: string;
  make: string;
  model: string;
  year: number;
  category: string;
  odometerKm: number | null;
  photoCount: number;
  title: string | null;
  permalink: string | null;
  importSource: string;
  sourceProductId: string;
};

export type ImportUrlAttempt = {
  adapter: string;
  error?: string;
};

export type ImportUrlResult =
  | { ok: true; dryRun?: boolean; queued?: boolean; preview: ImportUrlPreview; stock?: string; attempts: ImportUrlAttempt[] }
  | { ok: false; error: string; duplicate?: boolean; preview?: ImportUrlPreview; attempts?: ImportUrlAttempt[] };

async function parseFunctionInvokeError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as Record<string, unknown> | null;
      if (body && typeof body.error === "string" && body.error.trim()) {
        return body.error;
      }
    } catch {
      /* response body not JSON */
    }
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Import from URL failed.";
}

function parsePreview(raw: unknown): ImportUrlPreview | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.make !== "string" || typeof p.model !== "string" || typeof p.year !== "number") return null;
  if (typeof p.category !== "string" || typeof p.adapter !== "string") return null;
  return {
    adapter: p.adapter,
    make: p.make,
    model: p.model,
    year: p.year,
    category: p.category,
    odometerKm: typeof p.odometerKm === "number" ? p.odometerKm : p.odometerKm == null ? null : null,
    photoCount: typeof p.photoCount === "number" ? p.photoCount : 0,
    title: typeof p.title === "string" ? p.title : null,
    permalink: typeof p.permalink === "string" ? p.permalink : null,
    importSource: typeof p.importSource === "string" ? p.importSource : "",
    sourceProductId: typeof p.sourceProductId === "string" ? p.sourceProductId : ""
  };
}

function parseAttempts(raw: unknown): ImportUrlAttempt[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a) => a && typeof a === "object")
    .map((a) => {
      const o = a as Record<string, unknown>;
      return {
        adapter: typeof o.adapter === "string" ? o.adapter : "unknown",
        error: typeof o.error === "string" ? o.error : undefined
      };
    });
}

export async function importUrlToQueue(
  supabase: SupabaseClient,
  url: string,
  options?: { dryRun?: boolean }
): Promise<ImportUrlResult> {
  const { data, error } = await supabase.functions.invoke("import-url-to-queue", {
    method: "POST",
    body: { url: url.trim(), dryRun: options?.dryRun === true }
  });

  if (error) {
    return { ok: false, error: await parseFunctionInvokeError(error) };
  }

  const body = data as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Empty response from import URL service." };
  }

  const attempts = parseAttempts(body.attempts);
  const preview = parsePreview(body.preview) ?? undefined;

  if (body.ok !== true) {
    const err = typeof body.error === "string" ? body.error : "Import from URL failed.";
    return {
      ok: false,
      error: err,
      duplicate: body.duplicate === true,
      preview,
      attempts
    };
  }

  if (!preview) {
    return { ok: false, error: "Invalid import URL response.", attempts };
  }

  return {
    ok: true,
    dryRun: body.dryRun === true,
    queued: body.queued === true,
    preview,
    stock: typeof body.stock === "string" ? body.stock : undefined,
    attempts
  };
}
