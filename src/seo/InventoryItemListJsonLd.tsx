import { Helmet } from "react-helmet-async";
import type { InventoryPublicRow } from "../data/inventory";
import { buildInventoryItemListJsonLd } from "./inventoryStructuredData";

type Props = {
  rows: InventoryPublicRow[];
};

export function InventoryItemListJsonLd({ rows }: Props) {
  if (rows.length === 0) return null;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
  const jsonLd = buildInventoryItemListJsonLd(rows, { supabaseUrl: supabaseUrl || undefined });
  if (!jsonLd) return null;

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}
