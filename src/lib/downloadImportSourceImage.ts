import type { SupabaseClient } from "@supabase/supabase-js";

const IMPORT_IMAGE_PROXY_HOSTS = new Set(["overlandram.ca", "www.overlandram.ca", "motorsportsfinancing.ca"]);

export function importSourceImageNeedsProxy(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && IMPORT_IMAGE_PROXY_HOSTS.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function supabaseFunctionsBase(): string {
  const base = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "");
  if (!base) throw new Error("Missing VITE_SUPABASE_URL.");
  return `${base}/functions/v1/fetch-import-source-image`;
}

async function downloadViaImportImageProxy(supabase: SupabaseClient, url: string): Promise<Blob> {
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Sign in required to download import photos.");
  }
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!anonKey) {
    throw new Error("Missing VITE_SUPABASE_ANON_KEY.");
  }

  const res = await fetch(supabaseFunctionsBase(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ url })
  });

  if (!res.ok) {
    let detail = `Image proxy failed (${res.status}).`;
    try {
      const errBody = (await res.json()) as { error?: string };
      if (typeof errBody.error === "string" && errBody.error.trim()) {
        detail = errBody.error;
      }
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 404) {
      detail =
        "Import image proxy is not deployed. Run: npm run supabase:deploy-import-image-proxy (then retry).";
    }
    throw new Error(detail);
  }

  return res.blob();
}

export async function downloadImportSourceImage(supabase: SupabaseClient, url: string): Promise<Blob> {
  if (importSourceImageNeedsProxy(url)) {
    return downloadViaImportImageProxy(supabase, url);
  }
  const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "no-store" });
  if (!res.ok) throw new Error(`Image download failed (${res.status})`);
  return res.blob();
}
