import { Link } from "react-router-dom";
import type { StockDuplicateMatch } from "../lib/inventoryStockDuplicate";

type AdminStockDuplicateErrorProps = {
  stock: string;
  match: StockDuplicateMatch;
};

export function AdminStockDuplicateError({ stock, match }: AdminStockDuplicateErrorProps) {
  return (
    <div className="sell-ride-applyErrorBanner admin-stockDupError" role="alert">
      <p className="sell-ride-applyError">
        Cannot post, stock number {stock} already exists.
      </p>
      <Link className="btn btn-secondary admin-stockDupLink" to={`/admin/inventory?edit=${match.id}`}>
        Go to unit in catalog
      </Link>
    </div>
  );
}
