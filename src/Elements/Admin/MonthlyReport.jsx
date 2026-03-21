export default function MonthlyReport({ transactions, total }) {
  const cashSales = transactions.filter(t => t.method === "cash").reduce((s, t) => s + t.total, 0);
  const ewalletSales = transactions.filter(t => t.method === "ewallet").reduce((s, t) => s + t.total, 0);

  return (
    <div>
      {/* Stats */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card reports-stat-card reports-stat-green">
            <div className="card-body">
              <i className="bi bi-currency-dollar reports-stat-icon"></i>
              <div className="reports-stat-value">₱{total.toLocaleString()}</div>
              <div className="reports-stat-label">Monthly Revenue</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card reports-stat-card reports-stat-blue">
            <div className="card-body">
              <i className="bi bi-receipt reports-stat-icon"></i>
              <div className="reports-stat-value">{transactions.length}</div>
              <div className="reports-stat-label">Total Transactions</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card reports-stat-card reports-stat-yellow">
            <div className="card-body">
              <i className="bi bi-cash reports-stat-icon"></i>
              <div className="reports-stat-value">₱{cashSales.toLocaleString()}</div>
              <div className="reports-stat-label">Cash Sales</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card reports-stat-card reports-stat-blue">
            <div className="card-body">
              <i className="bi bi-phone reports-stat-icon"></i>
              <div className="reports-stat-value">₱{ewalletSales.toLocaleString()}</div>
              <div className="reports-stat-label">eWallet Sales</div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="card reports-card">
        <div className="card-body">
          <h6 className="reports-card-title">All Transactions</h6>
          <div className="reports-list">
            {transactions.map(tx => (
              <div key={tx.id} className="reports-transaction-item">
                <div className="reports-transaction-header">
                  <span className="reports-transaction-id">
                    #{tx.id} · <span className="reports-transaction-cashier">{tx.date} — {tx.cashier}</span>
                  </span>
                  <span className="reports-transaction-total">₱{tx.total.toLocaleString()}</span>
                </div>
                <div className="reports-transaction-details">
                  {tx.items.map(i => `${i.name} ×${i.qty}`).join(" · ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}