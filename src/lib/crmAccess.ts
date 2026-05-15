import type { SupabaseClient } from "@supabase/supabase-js";

export type CrmAccessRpcResult = {
  allowed: boolean;
  rpcError: string | null;
};

/**
 * Server-side CRM permission (Postgres function `public.user_has_crm_access`).
 * Refreshes the session first so new app_metadata / allowlist changes appear on the JWT.
 */
export async function fetchUserHasCrmAccess(client: SupabaseClient): Promise<CrmAccessRpcResult> {
  const { error: refreshError } = await client.auth.refreshSession();
  if (refreshError) {
    console.warn("refreshSession before CRM check:", refreshError.message);
  }

  const { data, error } = await client.rpc("user_has_crm_access");
  if (error) {
    console.warn("user_has_crm_access RPC failed:", error.message, error);
    return { allowed: false, rpcError: error.message };
  }
  return { allowed: Boolean(data), rpcError: null };
}
