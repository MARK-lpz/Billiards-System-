export default function InventoryReport({ products }) {
  const lowStockItems = products.filter(p => p.stock <= p.minStock).length;
  const totalValue = products.reduce((s, p) => s + p.price * p.stock, 0);

  return (
    <div>
      {/* Stats */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card reports-stat-card reports-stat-blue">
            <div className="card-body">
              <i className="bi bi-box-seam reports-stat-icon"></i>
              <div className="reports-stat-value">{products.length}</div>
              <div className="reports-stat-label">Total Products</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card reports-stat-card reports-stat-red">
            <div className="card-body">
              <i className="bi bi-exclamation-triangle reports-stat-icon"></i>
              <div className="reports-stat-value">{lowStockItems}</div>
              <div className="reports-stat-label">Low Stock Items</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card reports-stat-card reports-stat-green">
            <div className="card-body">
              <i className="bi bi-currency-dollar reports-stat-icon"></i>
              <div className="reports-stat-value">₱{totalValue.toLocaleString()}</div>
              <div className="reports-stat-label">Total Stock Value</div>
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card reports-card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table reports-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Min</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td className="reports-table-name">{p.name}</td>
                    <td>{p.category}</td>
                    <td className="reports-table-price">₱{p.price}</td>
                    <td className={p.stock <= p.minStock ? "reports-table-low-stock" : ""}>
                      {p.stock} {p.unit}
                    </td>
                    <td>{p.minStock}</td>
                    <td>₱{(p.price * p.stock).toLocaleString()}</td>
                    <td>
                      <span className={`badge reports-badge-${p.stock <= p.minStock ? "low" : "good"}`}>
                        {p.stock <= p.minStock ? "low" : "good"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}