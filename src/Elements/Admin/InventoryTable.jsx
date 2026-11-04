import { useEffect, useRef } from "react";
import { markMatches } from "../../utils/inventorySearch";
import { daysUntil, describeDaysLeft, expiryStageOf } from "../../utils/expiryAlerts";
import { isExpired } from "../../utils/productShelf";

// `highlightId`: a product opened from the admin's bell, marked and scrolled into view.
// `searchTerms`: the searched words, marked in each name.
// `today` (YYYY-MM-DD): to tag an expiry date within 5 days, or past. A product
// past it with stock left is Expired: not sold, until its stock is removed
// (`onRemoveExpired`) or replaced by a restock. `onArchive` moves it to the Archive.
// An expired product's buttons say what they do (Restock, Archive, Remove stock),
// and so do those of one expiring within 5 days (Restock, Archive, Pull out: its
// stock off the shelf early, `onPullOut`).
// `selectedIds` (a Set, on the Expiring Soon and Expired tabs): a tick box on each
// row, for archiving several together; `onToggleSelect(id)` ticks or unticks one.
export default function InventoryTable({
  products,
  onEdit,
  onArchive,
  onRemoveExpired,
  onPullOut,
  onRestock,
  highlightId = null,
  searchTerms = [],
  emptyMessage = "No products yet.",
  today = "",
  selectedIds = null,
  onToggleSelect,
}) {
  const highlightedRow = useRef(null);

  useEffect(() => {
    highlightedRow.current?.scrollIntoView?.({ block: "center" });
  }, [highlightId]);

  return (
    <div className="card inventory-table-card">
      <div className="card-body">
        <div className="table-responsive">
          <table className="table inventory-table">
            <thead>
              <tr>
                {selectedIds && (
                  <th className="inventory-select-cell" aria-label="Select"></th>
                )}
                <th>Product No.</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Retail Price</th>
                <th>Stock</th>
                <th>Min Stock</th>
                <th>Expiry</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr className="inventory-empty-row">
                  <td colSpan={selectedIds ? 10 : 9}>
                    <i className="bi bi-search" aria-hidden="true"></i>
                    {emptyMessage}
                  </td>
                </tr>
              )}
              {products.map(product => {
                const stockLeft = Number(product.stock) || 0;
                const minStock = Number(product.minStock) || 0;
                const isOutOfStock = stockLeft <= 0;
                const isLowStock = !isOutOfStock && stockLeft <= minStock;
                const isPastDate = Boolean(today) && isExpired(product, today);
                const hasExpiredStock = !isOutOfStock && isPastDate;
                const isSelected = Boolean(selectedIds?.has(product.id));
                const stockTone = isOutOfStock ? "out" : isLowStock ? "low" : "ok";
                const stockCeiling = Math.max(minStock, 1) * 2;
                const stockPercent = Math.max(0, Math.min(100, (stockLeft / stockCeiling) * 100));
                const isHighlighted = highlightId !== null && String(product.id) === String(highlightId);
                const expiryStage = today ? expiryStageOf(product, today) : null;
                const isExpiringSoon = !isOutOfStock && (expiryStage === "soon" || expiryStage === "urgent");

                return (
                  <tr
                    key={product.id}
                    ref={isHighlighted ? highlightedRow : undefined}
                    className={[
                      isOutOfStock || hasExpiredStock ? "inventory-row-danger" : isLowStock ? "inventory-row-warning" : "",
                      isHighlighted ? "inventory-row-focus" : "",
                      isSelected ? "inventory-row-selected" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    {selectedIds && (
                      <td className="inventory-select-cell">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelect(product.id)}
                          aria-label={`Select ${product.name}`}
                        />
                      </td>
                    )}
                    <td className="inventory-sku">
                      {product.productNumber || String(product.id).padStart(3, "0")}
                    </td>
                    <td>
                      <div className="inventory-product-name">
                        <i className="bi bi-box me-2"></i>
                        {markMatches(product.name, searchTerms).map((part, index) =>
                          part.hit ? <mark key={index} className="inventory-search-hit">{part.text}</mark> : part.text
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="inventory-category-badge">
                        {product.category}
                      </span>
                    </td>
                    <td className="inventory-price">
                      ₱{product.price.toLocaleString()}
                      <span className="inventory-price-unit"> / pc</span>
                      {/* What the hall paid for it; products added before this was kept have none. */}
                      {Number(product.originalPrice) > 0 && (
                        <span className="inventory-price-original">Original ₱{Number(product.originalPrice).toLocaleString()}</span>
                      )}
                    </td>
                    <td>
                      <div className="inventory-stock-cell">
                        <span className={`inventory-stock ${stockTone}`}>
                          {isOutOfStock && <i className="bi bi-x-circle-fill"></i>}
                          {isLowStock && <i className="bi bi-exclamation-triangle-fill"></i>}
                          {stockLeft} pcs
                        </span>
                        <div
                          className="inventory-stock-bar"
                          role="img"
                          aria-label={`${stockLeft} of a healthy level of ${stockCeiling} pcs`}
                        >
                          <div
                            className={`inventory-stock-bar-fill ${stockTone}`}
                            style={{ width: `${stockPercent}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted">{product.minStock} pcs</td>
                    <td className="inventory-detail-cell">
                      {product.expiryDate || "N/A"}
                      {expiryStage && (
                        <span className={`inventory-expiry-tag is-${expiryStage}`}>
                          <i className={`bi ${expiryStage === "soon" ? "bi-hourglass-split" : "bi-calendar-x-fill"}`} aria-hidden="true"></i>
                          {describeDaysLeft(daysUntil(product.expiryDate, today))}
                        </span>
                      )}
                    </td>
                    <td>
                      {hasExpiredStock ? (
                        <span className="badge inventory-badge-danger" title="The Sales / POS will not sell it">
                          <i className="bi bi-calendar-x me-1"></i>
                          Expired · Not for Sale
                        </span>
                      ) : isOutOfStock ? (
                        <span className="badge inventory-badge-danger">
                          <i className="bi bi-x-circle me-1"></i>
                          Out of Stock
                        </span>
                      ) : isLowStock ? (
                        <span className="badge inventory-badge-warning">
                          <i className="bi bi-exclamation-triangle me-1"></i>
                          Low Stock
                        </span>
                      ) : (
                        <span className="badge inventory-badge-success">
                          <i className="bi bi-check-circle me-1"></i>
                          In Stock
                        </span>
                      )}
                    </td>
                    <td>
                      {isExpiringSoon ? (
                        <div className="inventory-actions is-labeled">
                          <button
                            className="btn btn-sm btn-success has-label"
                            onClick={() => onRestock(product)}
                            title="Restock with new stock"
                          >
                            <i className="bi bi-arrow-up-circle"></i>
                            Restock
                          </button>
                          <button
                            className="btn btn-sm inventory-archive-btn has-label"
                            onClick={() => onArchive(product)}
                            title="Move to Archive before it expires"
                          >
                            <i className="bi bi-archive"></i>
                            Archive
                          </button>
                          <button
                            className="btn btn-sm inventory-pullout-btn has-label"
                            onClick={() => onPullOut(product)}
                            title="Take its stock off the shelf now (spoiled or cannot be sold); the product stays with 0 pcs"
                          >
                            <i className="bi bi-box-arrow-right"></i>
                            Pull out
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => onEdit(product)}
                            title="Edit prices: mark it down to sell it first"
                            aria-label={`Edit ${product.name}`}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                        </div>
                      ) : isPastDate ? (
                        <div className="inventory-actions is-labeled">
                          <button
                            className="btn btn-sm btn-success has-label"
                            onClick={() => onRestock(product)}
                            title="Restock with new stock"
                          >
                            <i className="bi bi-arrow-up-circle"></i>
                            Restock
                          </button>
                          <button
                            className="btn btn-sm inventory-archive-btn has-label"
                            onClick={() => onArchive(product)}
                            title="Move to Archive"
                          >
                            <i className="bi bi-archive"></i>
                            Archive
                          </button>
                          {hasExpiredStock && (
                            <button
                              className="btn btn-sm btn-danger has-label"
                              onClick={() => onRemoveExpired(product)}
                              title="Take the expired pieces off the shelf; the product stays with 0 pcs"
                            >
                              <i className="bi bi-calendar-x"></i>
                              Remove stock
                            </button>
                          )}
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => onEdit(product)}
                            title="Edit prices"
                            aria-label={`Edit ${product.name}`}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                        </div>
                      ) : (
                        <div className="inventory-actions">
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => onRestock(product)}
                            title="Restock"
                          >
                            <i className="bi bi-arrow-up-circle"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => onEdit(product)}
                            title="Edit"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => onArchive(product)}
                            title="Move to Archive"
                          >
                            <i className="bi bi-archive"></i>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
