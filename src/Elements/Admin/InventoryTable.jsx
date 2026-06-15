export default function InventoryTable({ products, onEdit, onDelete, onRestock }) {
  return (
    <div className="card inventory-table-card">
      <div className="card-body">
        <div className="table-responsive">
          <table className="table inventory-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Supplier</th>
                <th>Location</th>
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
                const isLowStock = product.stock <= product.minStock;
                const isOutOfStock = product.stock === 0;
                
                return (
                  <tr key={product.id} className={isLowStock ? "inventory-row-warning" : ""}>
                    <td className="inventory-sku">{product.sku || "-"}</td>
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
                    <td className="inventory-detail-cell">{product.supplier || "-"}</td>
                    <td className="inventory-detail-cell">{product.location || "-"}</td>
                    <td className="inventory-price">₱{product.price.toLocaleString()}</td>
                    <td>
                      <span className={`inventory-stock ${isLowStock ? "low" : ""}`}>
                        {product.stock} {product.unit}
                      </span>
                    </td>
                    <td className="text-muted">{product.minStock} {product.unit}</td>
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
