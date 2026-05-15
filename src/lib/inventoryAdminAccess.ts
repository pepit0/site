import type { SupabaseClient } from "@supabase/supabase-js";

export type InventoryAdminRpcResult = {
  allowed: boolean;
  rpcError: string | null;
};

export async function fetchUserCanManageInventory(client: SupabaseClient): Promise<InventoryAdminRpcResult> {
  const { data, error } = await client.rpc("user_can_manage_inventory");
  if (error) {
    console.warn("user_can_manage_inventory RPC failed:", error.message, error);
    return { allowed: false, rpcError: error.message };
  }
  return { allowed: Boolean(data), rpcError: null };
}
