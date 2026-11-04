import { useState } from "react";
import { markMatches } from "../../utils/inventorySearch";
import { formatExpiryDate } from "../../utils/inventoryValidation";
import { ARCHIVE_REASONS, isExpired, writeOffCost } from "../../utils/productShelf";

const peso = (value) =>
  `₱${(Number(value) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatWhen = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

const VIEWS = [
  { id: "products", label: "Archived products", icon: "bi-archive" },
  { id: "expired", label: "Expired stock removed", icon: "bi-calendar-x" },
];

/** The Archive's cards, in place of the Inventory's: `totals` counts the whole Archive. */
export function InventoryArchiveStats({ totals }) {
  return (
    <div className="stats-grid mb-4 inventory-archive-stats">
      <div className="card inventory-stat-card inventory-stat-blue">
        <div className="card-body">
          <i className="bi bi-archive inventory-stat-icon"></i>
          <div className="inventory-stat-value">{totals.products}</div>
          <div className="inventory-stat-label">Archived Products</div>
        </div>
      </div>
      <div className="card inventory-stat-card inventory-stat-red">
        <div className="card-body">
          <i className="bi bi-calendar-x inventory-stat-icon"></i>
          <div className="inventory-stat-value">{totals.expiredPieces.toLocaleString("en-PH")} pcs</div>
          <div className="inventory-stat-label">Expired Stock Removed</div>
        </div>
      </div>
      <div className="card inventory-stat-card inventory-stat-yellow">
        <div className="card-body">
          <i className="bi bi-cash-coin inventory-stat-icon"></i>
          <div className="inventory-stat-value">{peso(totals.loss)}</div>
          <div className="inventory-stat-label">Lost to Expiry</div>
        </div>
      </div>
    </div>
  );
}

/**
 * The Inventory's Archive: the hall's previous goods (utils/productShelf.js).
 * Archived products, each with Restore and Delete permanently, and every batch
 * of expired stock taken off the shelf, with what it cost. `products` and
 * `writeOffs` come already searched.
 */
export default function InventoryArchive({
  products,
  writeOffs,
  searchTerms = [],
  emptyMessage,
  today,
  highlightId = null,
  onRestore,
  onDelete,
}) {
  const [view, setView] = useState("products");
  const name = (text) =>
    markMatches(text, searchTerms).map((part, index) =>
      part.hit ? <mark key={index} className="inventory-search-hit">{part.text}</mark> : part.text
    );

  return (
    <div className="card inventory-table-card">
      <div className="inventory-archive-views" role="tablist" aria-label="Archive">
        {VIEWS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={view === entry.id}
            className={`inventory-archive-view${view === entry.id ? " is-active" : ""}`}
            onClick={() => setView(entry.id)}
          >
            <i className={`bi ${entry.icon}`} aria-hidden="true"></i>
            {entry.label}
            <span className="inventory-archive-count">{entry.id === "products" ? products.length : writeOffs.length}</span>
          </button>
        ))}
      </div>

      <div className="card-body">
        <div className="table-responsive">
          {view === "products" ? (
            <table className="table inventory-table">
              <thead>
                <tr>
                  <th>Product No.</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Retail Price</th>
                  <th>Stock Kept</th>
                  <th>Archived</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 && (
                  <tr className="inventory-empty-row">
                    <td colSpan={8}>
                      <i className="bi bi-archive" aria-hidden="true"></i>
                      {emptyMessage("archived products")}
                    </td>
                  </tr>
                )}
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className={highlightId !== null && String(product.id) === String(highlightId) ? "inventory-row-focus" : ""}
                  >
                    <td className="inventory-sku">{product.productNumber || String(product.id).padStart(3, "0")}</td>
                    <td>
                      <div className="inventory-product-name">
                        <i className="bi bi-box me-2"></i>
                        {name(product.name)}
                      </div>
                    </td>
                    <td>
                      <span className="inventory-category-badge">{product.category}</span>
                    </td>
                    <td className="inventory-price">{peso(product.price)}</td>
                    <td>
                      {Number(product.stock) || 0} pcs
                      {product.expiryDate && (
                        <span className={`inventory-archive-sub${isExpired(product, today) ? " is-expired" : ""}`}>
                          {isExpired(product, today) ? "Expired" : "Expires"} {formatExpiryDate(product.expiryDate)}
                        </span>
                      )}
                    </td>
                    <td className="inventory-detail-cell">
                      {formatWhen(product.archivedAt)}
                      {product.archivedBy && <span className="inventory-archive-sub">by {product.archivedBy}</span>}
                    </td>
                    <td>
                      <span className={`badge ${product.archiveReason === "expired" ? "inventory-badge-danger" : "inventory-badge-archived"}`}>
                        {ARCHIVE_REASONS[product.archiveReason] || "Archived"}
                      </span>
                    </td>
                    <td>
                      <div className="inventory-actions">
                        <button className="btn btn-sm btn-success" onClick={() => onRestore(product)} title="Restore to the Inventory">
                          <i className="bi bi-arrow-counterclockwise"></i>
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => onDelete(product)} title="Delete permanently">
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="table inventory-table">
              <thead>
                <tr>
                  <th>Removed</th>
                  <th>Product</th>
                  <th>Pieces</th>
                  <th>Expired On</th>
                  <th>Cost</th>
                  <th>Removed By</th>
                </tr>
              </thead>
              <tbody>
                {writeOffs.length === 0 && (
                  <tr className="inventory-empty-row">
                    <td colSpan={6}>
                      <i className="bi bi-calendar-x" aria-hidden="true"></i>
                      {emptyMessage("expired stock records")}
                    </td>
                  </tr>
                )}
                {writeOffs.map((record) => {
                  const cost = writeOffCost(record);
                  return (
                    <tr key={record.id}>
                      <td className="inventory-detail-cell">{formatWhen(record.at)}</td>
                      <td>
                        <div className="inventory-product-name">
                          <i className="bi bi-box me-2"></i>
                          {name(record.product.name)}
                        </div>
                        <span className="inventory-archive-sub">
                          #{record.product.productNumber}
                          {record.product.archivedAt ? " · archived" : ""}
                          {record.note ? ` · ${record.note}` : ""}
                        </span>
                      </td>
                      <td>{record.qty} pcs</td>
                      <td>{record.expiryDate ? formatExpiryDate(record.expiryDate) : "—"}</td>
                      <td className="inventory-price">
                        {cost === null ? "—" : peso(cost)}
                        {cost !== null && <span className="inventory-price-original">{peso(record.unitCost)} each</span>}
                      </td>
                      <td className="text-muted">{record.by || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
