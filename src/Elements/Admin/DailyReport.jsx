export default function DailyReport({ transactions, total }) {
  const avgSale = transactions.length ? total / transactions.length : 0;

  return (
    <div>
      {/* Stats */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card reports-stat-card reports-stat-green">
            <div className="card-body">
              <i className="bi bi-currency-dollar reports-stat-icon"></i>
              <div className="reports-stat-value">₱{total.toLocaleString()}</div>
              <div className="reports-stat-label">Today's Revenue</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card reports-stat-card reports-stat-blue">
            <div className="card-body">
              <i className="bi bi-receipt reports-stat-icon"></i>
              <div className="reports-stat-value">{transactions.length}</div>
              <div className="reports-stat-label">Transactions</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card reports-stat-card reports-stat-yellow">
            <div className="card-body">
              <i className="bi bi-graph-up reports-stat-icon"></i>
              <div className="reports-stat-value">₱{avgSale.toLocaleString()}</div>
              <div className="reports-stat-label">Avg. Sale</div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="card reports-card">
        <div className="card-body">
          <h6 className="reports-card-title">Today's Transactions</h6>
          {transactions.length === 0 ? (
            <div className="reports-empty">
              <i className="bi bi-inbox"></i>
              <p>No transactions today</p>
            </div>
          ) : (
            <div className="reports-list">
              {transactions.map(tx => (
                <div key={tx.id} className="reports-transaction-item">
                  <div className="reports-transaction-header">
                    <span className="reports-transaction-id">
                      Transaction #{tx.id} · <span className="reports-transaction-cashier">{tx.cashier}</span>
                    </span>
                    <span className="reports-transaction-total">₱{tx.total.toLocaleString()}</span>
                  </div>
                  <div className="reports-transaction-details">
                    {tx.items.map(i => `${i.name} ×${i.qty}`).join(" · ")} · 
                    <span className="reports-payment-badge">{tx.method.toUpperCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}