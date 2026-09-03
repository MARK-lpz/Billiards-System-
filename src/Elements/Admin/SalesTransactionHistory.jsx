const fmtPeso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function SalesTransactionHistory({ transactions = [], servedOrderTickets = [] }) {
  const historyCount = transactions.length + servedOrderTickets.length;

  return (
    <div className="order-history-layout order-history-layout--single">
      <div className="order-history-section">
        <div className="order-history-section-header completed">
          <span className="order-dot" style={{ background: "var(--green, #22c55e)" }} />
          <span>Transaction History ({historyCount})</span>
        </div>

        {historyCount === 0 ? (
          <div className="order-history-empty">No transactions yet.</div>
        ) : (
          <>
            {servedOrderTickets.map((ticket) => {
              const ticketTotal = ticket.items.reduce((sum, item) => sum + item.price * item.qty, 0);

              return (
                <div key={`served-${ticket.id}`} className="order-history-card completed-card">
                  <div className="order-history-card-header">
                    <span className="order-history-cashier">
                      <i className="bi bi-bag-check me-2"></i>
                      Served Order #{String(ticket.id).slice(-5)}
                    </span>
                    <span className="order-history-total">{fmtPeso(ticketTotal)}</span>
                  </div>

                  <div className="order-history-meta">
                    <i className="bi bi-check-circle me-1"></i>
                    Served {ticket.servedAt ? `at ${ticket.servedAt}` : ""}
                    {ticket.date ? ` • ${ticket.date}` : ""}
                  </div>

                  <div className="order-history-items">
                    {ticket.items.map((item) => (
                      <span key={item.id} className="order-history-item-pill">
                        {item.name} ×{item.qty}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}

            {transactions.map((tx) => (
            <div key={tx.id} className="order-history-card completed-card">
              <div className="order-history-card-header">
                <span className="order-history-cashier">
                  <i className="bi bi-receipt me-2"></i>
                  #{String(tx.id).slice(-5)}
                </span>

                <span className="order-history-total">{fmtPeso(tx.total)}</span>
              </div>

              <div className="order-history-meta">
                <i className={`bi ${tx.method === "cash" ? "bi-cash" : "bi-phone"} me-1`}></i>
                {tx.method === "cash" ? "Cash" : "eWallet"}
                {tx.time ? ` • ${tx.time}` : ""}
                {tx.date ? ` • ${tx.date}` : ""}
              </div>

              {tx.discAmt > 0 && (
                <div className="order-history-discount">
                  <i className="bi bi-tag me-1"></i>
                  {tx.discLabel} • saved {fmtPeso(tx.discAmt)}
                </div>
              )}

              <div className="order-history-items">
                {tx.items?.map((item, index) => (
                  <span key={`${tx.id}-${index}`} className="order-history-item-pill">
                    {item.name} ×{item.qty}
                  </span>
                ))}
              </div>
            </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
