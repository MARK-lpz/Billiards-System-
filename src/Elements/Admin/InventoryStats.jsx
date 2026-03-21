export default function InventoryStats({ stats }) {
  return (
    <div className="row g-3 mb-4">
      <div className="col-md-3">
        <div className="card inventory-stat-card inventory-stat-blue">
          <div className="card-body">
            <i className="bi bi-box-seam inventory-stat-icon"></i>
            <div className="inventory-stat-value">{stats.total}</div>
            <div className="inventory-stat-label">Total Products</div>
          </div>
        </div>
      </div>
      <div className="col-md-3">
        <div className="card inventory-stat-card inventory-stat-yellow">
          <div className="card-body">
            <i className="bi bi-exclamation-triangle inventory-stat-icon"></i>
            <div className="inventory-stat-value">{stats.lowStock}</div>
            <div className="inventory-stat-label">Low Stock</div>
          </div>
        </div>
      </div>
      <div className="col-md-3">
        <div className="card inventory-stat-card inventory-stat-green">
          <div className="card-body">
            <i className="bi bi-currency-dollar inventory-stat-icon"></i>
            <div className="inventory-stat-value">₱{stats.totalValue.toLocaleString()}</div>
            <div className="inventory-stat-label">Total Value</div>
          </div>
        </div>
      </div>
      <div className="col-md-3">
        <div className="card inventory-stat-card inventory-stat-red">
          <div className="card-body">
            <i className="bi bi-x-circle inventory-stat-icon"></i>
            <div className="inventory-stat-value">{stats.outOfStock}</div>
            <div className="inventory-stat-label">Out of Stock</div>
          </div>
        </div>
      </div>
    </div>
  );
}