import { supabase } from "./supabase";

type RpcRow = { ok?: boolean; error?: string | null };

function isMissingRpcError(message: string, code?: string): boolean {
  if (code === "PGRST202" || code === "42883") return true;
  return /could not find the function|does not exist|schema cache/i.test(message);
}

/**
 * Permanently removes a rejected submission row. Prefer security-definer RPC (09 SQL);
 * falls back to client DELETE when the RPC is not deployed yet (requires 08 SQL).
 * Remove photos from `sell-ride-photos` after this succeeds.
 */
export async function adminDeleteRejectedSellRideSubmission(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("admin_delete_rejected_sell_ride_submission", { p_id: id });
  if (!error) {
    const row = data as RpcRow | null;
    if (row?.ok) return { ok: true };
    return { ok: false, error: row?.error ?? "Delete failed." };
  }
  if (isMissingRpcError(error.message, "code" in error ? String((error as { code?: string }).code) : undefined)) {
    const { data: deleted, error: delErr } = await supabase
      .from("sell_ride_submissions")
      .delete()
      .eq("id", id)
      .eq("status", "rejected")
      .select("id");
    if (delErr) return { ok: false, error: delErr.message };
    if (!deleted?.length) {
      return {
        ok: false,
        error:
          "Could not delete row. Run sql/marketing/09_admin_delete_rejected_sell_ride.sql on your Supabase project."
      };
    }
    return { ok: true };
  }
  return { ok: false, error: error.message };
}
