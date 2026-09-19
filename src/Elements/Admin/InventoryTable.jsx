export default function InventoryTable({ products, onEdit, onDelete, onRestock }) {
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
                <th>Price</th>
                <th>Stock</th>
                <th>Min Stock</th>
                <th>Expiry</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => {
                const stockLeft = Number(product.stock) || 0;
                const minStock = Number(product.minStock) || 0;
                const isOutOfStock = stockLeft <= 0;
                const isLowStock = !isOutOfStock && stockLeft <= minStock;
                const stockTone = isOutOfStock ? "out" : isLowStock ? "low" : "ok";
                const stockCeiling = Math.max(minStock, 1) * 2;
                const stockPercent = Math.max(0, Math.min(100, (stockLeft / stockCeiling) * 100));

                return (
                  <tr
                    key={product.id}
                    className={isOutOfStock ? "inventory-row-danger" : isLowStock ? "inventory-row-warning" : ""}
                  >
                    <td className="inventory-sku">
                      {product.productNumber || String(product.id).padStart(3, "0")}
                    </td>
                    <td>
                      <div className="inventory-product-name">
                        <i className="bi bi-box me-2"></i>
                        {product.name}
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
                    <td className="inventory-detail-cell">{product.expiryDate || "N/A"}</td>
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
