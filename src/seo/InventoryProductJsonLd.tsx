import { Helmet } from "react-helmet-async";
import type { InventoryPublicRow } from "../data/inventory";
import { buildInventoryProductJsonLd } from "./inventoryStructuredData";

type Props = {
  row: InventoryPublicRow;
};

export function InventoryProductJsonLd({ row }: Props) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
  if (!supabaseUrl) return null;

  const jsonLd = buildInventoryProductJsonLd(row, { supabaseUrl });
  if (!jsonLd) return null;

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}
