import { useEffect, useRef } from "react";
import { markMatches } from "../../utils/inventorySearch";
import { daysUntil, describeDaysLeft, expiryStageOf } from "../../utils/expiryAlerts";

// `highlightId`: a product opened from the admin's bell, marked and scrolled into view.
// `searchTerms`: the searched words, marked in each name.
// `today` (YYYY-MM-DD): to tag an expiry date within 5 days, or past.
export default function InventoryTable({
  products,
  onEdit,
  onDelete,
  onRestock,
  highlightId = null,
  searchTerms = [],
  emptyMessage = "No products yet.",
  today = "",
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
                  <td colSpan={9}>
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
                const stockTone = isOutOfStock ? "out" : isLowStock ? "low" : "ok";
                const stockCeiling = Math.max(minStock, 1) * 2;
                const stockPercent = Math.max(0, Math.min(100, (stockLeft / stockCeiling) * 100));
                const isHighlighted = highlightId !== null && String(product.id) === String(highlightId);
                const expiryStage = today ? expiryStageOf(product, today) : null;

                return (
                  <tr
                    key={product.id}
                    ref={isHighlighted ? highlightedRow : undefined}
                    className={[
                      isOutOfStock ? "inventory-row-danger" : isLowStock ? "inventory-row-warning" : "",
                      isHighlighted ? "inventory-row-focus" : "",
                    ].filter(Boolean).join(" ")}
                  >
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
                      {isOutOfStock ? (
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
                          className="btn btn-sm btn-danger"
                          onClick={() => onDelete(product.id)}
                          title="Delete"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
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
