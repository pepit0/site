import { Helmet } from "react-helmet-async";
import type { InventoryPublicRow } from "../data/inventory";
import { buildInventoryItemListJsonLd } from "./inventoryStructuredData";

type Props = {
  rows: InventoryPublicRow[];
};

export function InventoryItemListJsonLd({ rows }: Props) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
  if (!supabaseUrl || rows.length === 0) return null;

  const jsonLd = buildInventoryItemListJsonLd(rows, { supabaseUrl });
  if (!jsonLd) return null;

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}
